#!/usr/bin/env python3
"""
CreativeMate LLM Utils with RAG support using Langchain and Chroma.
Handles both document ingestion and chat with retrieval.
"""

import sys
import json
import base64
import os
import tempfile
from pathlib import Path
import ollama
from ollama import chat

# Import Whisper integration
try:
    from .whisper_integration import integrate_with_existing_system
    WHISPER_INTEGRATION_AVAILABLE = True
except ImportError:
    try:
        from whisper_integration import integrate_with_existing_system
        WHISPER_INTEGRATION_AVAILABLE = True
    except ImportError:
        print("Whisper integration not available", file=sys.stderr)
        WHISPER_INTEGRATION_AVAILABLE = False

# RAG imports
try:
    from langchain_community.document_loaders import PyPDFLoader
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain_ollama import OllamaEmbeddings
    from langchain_chroma import Chroma
    RAG_AVAILABLE = True
except ImportError as e:
    print(f"RAG dependencies not available: {e}", file=sys.stderr)
    RAG_AVAILABLE = False

# Chroma database directory
CHROMA_DB_PATH = "./chroma_db"
EMBEDDING_MODEL = "nomic-embed-text"

def ensure_chroma_db_exists():
    """Ensure the Chroma database directory exists."""
    os.makedirs(CHROMA_DB_PATH, exist_ok=True)

def ingest_document(document_data):
    """
    Ingest a PDF document into the Chroma vector store.
    
    Args:
        document_data (dict): Contains 'content' (base64), 'filename', and 'size'
    
    Returns:
        str: Success or error message
    """
    if not RAG_AVAILABLE:
        return "RAG dependencies not installed. Please install langchain, chromadb, and pypdf."
    
    try:
        # Decode base64 content
        pdf_content = base64.b64decode(document_data['content'])
        filename = document_data['filename']
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            temp_file.write(pdf_content)
            temp_file_path = temp_file.name
        
        try:
            # Load PDF document
            loader = PyPDFLoader(temp_file_path)
            documents = loader.load()
            
            print(f"Loaded {len(documents)} pages from {filename}", file=sys.stderr)
            
            # Split documents into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len,
            )
            chunks = text_splitter.split_documents(documents)
            
            print(f"Split into {len(chunks)} chunks", file=sys.stderr)
            
            # Add metadata to chunks
            for chunk in chunks:
                chunk.metadata['source_filename'] = filename
                chunk.metadata['document_type'] = 'pdf'
            
            # Ensure Chroma DB directory exists
            ensure_chroma_db_exists()
            
            # Initialize embeddings
            embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
            
            # Create or update Chroma vector store
            vectorstore = Chroma.from_documents(
                documents=chunks,
                embedding=embeddings,
                persist_directory=CHROMA_DB_PATH,
                collection_name="creativemate_docs"
            )
            
            # Persist the database
            # vectorstore.persist() - Not needed anymore
            
            print(f"Successfully ingested {filename} into vector store", file=sys.stderr)
            return f"Successfully processed and indexed {filename}. Added {len(chunks)} text chunks to knowledge base."
            
        finally:
            # Clean up temporary file
            os.unlink(temp_file_path)
            
    except Exception as e:
        print(f"Error during document ingestion: {e}", file=sys.stderr)
        return f"Error processing document: {str(e)}"

def retrieve_relevant_context(query, max_chunks=3):
    """
    Retrieve relevant context from the Chroma vector store.
    
    Args:
        query (str): The user's query
        max_chunks (int): Maximum number of chunks to retrieve
    
    Returns:
        str: Formatted context string
    """
    if not RAG_AVAILABLE:
        return ""
    
    try:
        # Check if Chroma DB exists
        if not os.path.exists(CHROMA_DB_PATH):
            print("No knowledge base found", file=sys.stderr)
            return ""
        
        # Initialize embeddings and vector store
        embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
        vectorstore = Chroma(
            persist_directory=CHROMA_DB_PATH,
            embedding_function=embeddings,
            collection_name="creativemate_docs"
        )
        
        # Create retriever
        retriever = vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": max_chunks}
        )
        
        # Retrieve relevant documents
        relevant_docs = retriever.invoke(query)
        
        if not relevant_docs:
            print("No relevant documents found", file=sys.stderr)
            return ""
        
        # Format context
        context_parts = []
        for i, doc in enumerate(relevant_docs):
            source = doc.metadata.get('source_filename', 'Unknown')
            page = doc.metadata.get('page', 'Unknown')
            content = doc.page_content.strip()
            
            context_parts.append(f"[Document: {source}, Page: {page}]\n{content}")
        
        context = "\n\n".join(context_parts)
        print(f"Retrieved {len(relevant_docs)} relevant chunks", file=sys.stderr)
        
        return context
        
    except Exception as e:
        print(f"Error during context retrieval: {e}", file=sys.stderr)
        return ""

def chat_with_model(input_data):
    """
    Main chat function with RAG support and Whisper STT integration.
    """
    # First, process any audio input with Whisper STT
    if WHISPER_INTEGRATION_AVAILABLE:
        input_data = integrate_with_existing_system(input_data)
    
    prompt_text = input_data.get('prompt', '')
    images = input_data.get('images', [])
    messages = input_data.get('messages', [])
    audio_base64 = input_data.get('audio', None) or input_data.get('audioBuffer', None)
    
    # Send transcription result first if we had audio input
    if audio_base64 or input_data.get('had_audio', False):
        transcription_event = {
            'type': 'transcription',
            'content': prompt_text
        }
        print(f"data: {json.dumps(transcription_event)}", flush=True)

    print(f"Received prompt: {prompt_text}", file=sys.stderr)
    print(f"Received {len(images)} images", file=sys.stderr)
    print(f"Received {len(messages)} messages in history", file=sys.stderr)
    print(f"Processed audio: {'Yes' if input_data.get('had_audio', False) else 'No'}", file=sys.stderr)
    
    if not prompt_text and images == []:
        return "No input provided"

    try:
        # Retrieve relevant context from RAG if available
        relevant_context = ""
        if prompt_text:
            relevant_context = retrieve_relevant_context(prompt_text)
        
        # Construct the conversation history for Ollama
        ollama_messages = []
        
        # Enhanced system prompt with RAG context
        system_prompt = '''You are a friendly, helpful master in creative arts and literature and a universal traanslator. You will receive a prompt text and conversation history if there is history. Detect the language used by the user. Then, using the user language, respond based on the provided prompt context.

Do not explain or reveal technical software details or your implementation. Answer in a clear, concise language. Always output in markdown format. Never reveal internal code implementation or assumptions. Stay in your scope which is about writing stories, poems, musical pieces and art ideas.

If relevant context from uploaded documents is provided, use that information to enhance your creative responses, but integrate it naturally without explicitly mentioning that you're referencing uploaded documents. Do not invent or fabricate information. If you don't know the answer, say "I don't know" or "I cannot answer that.". Do not make up answers.'''

        # Add relevant context to system prompt if available
        if relevant_context:
            system_prompt += f"\n\nRelevant context from your knowledge base:\n{relevant_context}"
            print("Added RAG context to system prompt", file=sys.stderr)
        
        ollama_messages.append({'role': 'system', 'content': system_prompt})
        
        # Add previous messages from conversation history
        for msg in messages:
            ollama_messages.append({
                'role': msg['role'],
                'content': msg['content']
            })
        
        # Prepare the current message content
        current_message_content = prompt_text
        
        # Handle images
        if images:
            for idx, img_b64 in enumerate(images):
                ollama_messages.append({
                    'role': 'user',
                    'content': f"[Image {idx + 1}: {img_b64['base64']}]"
                })
        
        # Add the current user message
        ollama_messages.append({
            'role': 'user',
            'content': current_message_content
        })

        print(f"Sending {len(ollama_messages)} messages to Ollama", file=sys.stderr)
        for i, msg in enumerate(ollama_messages):
            content_preview = msg['content'][:100].replace('\n', ' ') + "..." if len(msg['content']) > 100 else msg['content']
            print(f"  Message {i+1}: {msg['role']} - {content_preview}", file=sys.stderr)
        
        # Stream response from Ollama
        stream = ollama.chat(
            model='gemma3n:e4b',
            messages=ollama_messages,
            stream=True
        )

        full_response_content = []
        for chunk in stream:
            if 'content' in chunk['message'] and chunk['message']['content'] is not None:
                chunk_event = {
                    'type': 'chunk',
                    'content': chunk['message']['content']
                }
                print(f"data: {json.dumps(chunk_event)}", flush=True)
                full_response_content.append(chunk['message']['content'])
        
        # Send completion event
        complete_event = {
            'type': 'complete',
            'code': 0
        }
        print(f"data: {json.dumps(complete_event)}", flush=True)
        
        return "".join(full_response_content)

    except Exception as e:
        error_msg = f"An error occurred: {e}. Try again later."
        print(error_msg, file=sys.stderr)
        error_event = {
            'type': 'error',
            'content': error_msg
        }
        print(f"data: {json.dumps(error_event)}", flush=True)
        return error_msg

def main():
    """Main function to handle both document ingestion and chat."""
    try:
        input_json = sys.stdin.read()
        input_data = json.loads(input_json)
        
        # Check if this is a document ingestion request
        if 'document_to_ingest' in input_data:
            print("Processing document for RAG ingestion", file=sys.stderr)
            result = ingest_document(input_data['document_to_ingest'])
            print(result, end='', flush=True)
        elif 'audio_to_transcribe' in input_data:
            print("Processing audio for transcription only", file=sys.stderr)
            result = handle_audio_transcription(input_data['audio_to_transcribe'])
            print(result, end='', flush=True)
        else:
            # Regular chat request
            result = chat_with_model(input_data)
            
    except json.JSONDecodeError as e:
        error_msg = f"Error parsing JSON input from stdin: {e}"
        print(error_msg, file=sys.stderr)
        print(error_msg, end='', flush=True)
        sys.exit(1)
    except Exception as e:
        error_msg = f"An unexpected error occurred: {e}"
        print(error_msg, file=sys.stderr)
        print(error_msg, end='', flush=True)
        sys.exit(1)

def handle_audio_transcription(audio_base64):
    """
    Handle audio transcription only (no chat response).
    
    Args:
        audio_base64 (str): Base64-encoded audio data
    
    Returns:
        str: Transcribed text
    """
    if not WHISPER_INTEGRATION_AVAILABLE:
        return "Whisper integration not available. Please install dependencies."
    
    try:
        from whisper_integration import CreativeMateWhisperSTT
        
        # Initialize Whisper STT
        whisper_stt = CreativeMateWhisperSTT(model_size='small')
        
        if whisper_stt.is_available():
            transcribed_text = whisper_stt.transcribe_audio_data(audio_base64)
            print(f"Audio transcribed successfully: {transcribed_text[:50]}...", file=sys.stderr)
            return transcribed_text
        else:
            return "Whisper STT not available. Please install dependencies."
            
    except Exception as e:
        print(f"Error during audio transcription: {e}", file=sys.stderr)
        return f"Transcription error: {str(e)}"

if __name__ == "__main__":
    main()