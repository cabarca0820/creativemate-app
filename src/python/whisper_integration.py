#!/usr/bin/env python3
"""
Whisper Integration for CreativeMate
===================================

This module integrates Whisper offline speech-to-text with the existing CreativeMate system.
It provides a drop-in replacement for online speech recognition that works entirely offline.
"""

import sys
import json
import base64
import tempfile
import os
from pathlib import Path

try:
    from .whisper_stt import WhisperSTT
    WHISPER_AVAILABLE = True
except ImportError:
    try:
        from whisper_stt import WhisperSTT
        WHISPER_AVAILABLE = True
    except ImportError:
        # print("Whisper STT not available. Install dependencies: pip install openai-whisper pyaudio pydub numpy", file=sys.stderr)
        print("Whisper STT not available. Contact support.", file=sys.stderr)
        WHISPER_AVAILABLE = False

class CreativeMateWhisperSTT:
    """
    Whisper STT integration for CreativeMate chat system.
    """
    
    def __init__(self, model_size: str = 'base'):
        """
        Initialize the Whisper STT for CreativeMate.
        
        Args:
            model_size (str): Whisper model size to use
        """
        self.model_size = model_size
        self.whisper_stt = None
        
        if WHISPER_AVAILABLE:
            try:
                self.whisper_stt = WhisperSTT(model_size=model_size)
                print(f"Whisper STT initialized with model: {model_size}", file=sys.stderr)
            except Exception as e:
                print(f"Failed to initialize Whisper STT: {e}", file=sys.stderr)
                self.whisper_stt = None
        else:
            print("Whisper STT dependencies not available", file=sys.stderr)
    
    def transcribe_audio_data(self, audio_base64: str) -> str:
        """
        Transcribe base64-encoded audio data.
        
        Args:
            audio_base64 (str): Base64-encoded audio data
            
        Returns:
            str: Transcribed text or error message
        """
        if not self.whisper_stt:
            return "Whisper STT not available. Please install dependencies."
        
        try:
            # Decode base64 audio data
            audio_data = base64.b64decode(audio_base64)
            
            # Create temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            try:
                # Transcribe the audio file
                result = self.whisper_stt.transcribe_file(temp_file_path)
                
                if result and result['text']:
                    transcribed_text = result['text'].strip()
                    detected_language = result.get('language', 'unknown')
                    
                    print(f"Whisper transcription successful. Language: {detected_language}", file=sys.stderr)
                    return transcribed_text
                else:
                    return "Failed to transcribe audio. Please try speaking more clearly."
                    
            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                    
        except Exception as e:
            print(f"Error during Whisper transcription: {e}", file=sys.stderr)
            return f"Transcription error: {str(e)}"
    
    def is_available(self) -> bool:
        """Check if Whisper STT is available and ready."""
        return self.whisper_stt is not None
    
    def get_model_info(self) -> dict:
        """Get information about the current model."""
        if self.whisper_stt:
            return self.whisper_stt.get_model_info()
        return {'error': 'Whisper STT not available'}


def integrate_with_existing_system(input_data: dict) -> str:
    """
    Integration function that can be called from the existing llmUtils.py system.
    
    Args:
        input_data (dict): Input data containing audio and other information
        
    Returns:
        str: Response text (either transcription or chat response)
    """
    # Check if this is an audio transcription request
    audio_base64 = input_data.get('audio', None) or input_data.get('audioBuffer', None)
    
    if audio_base64:
        print("Processing audio with Whisper STT", file=sys.stderr)
        
        # Initialize Whisper STT (you can make model size configurable)
        whisper_stt = CreativeMateWhisperSTT(model_size='small')
        
        if whisper_stt.is_available():
            # Transcribe the audio
            transcribed_text = whisper_stt.transcribe_audio_data(audio_base64)
            
            # Update the input data with transcribed text
            original_prompt = input_data.get('prompt', '')
            if original_prompt:
                input_data['prompt'] = f"{original_prompt}\n\n[Voice input transcribed]: {transcribed_text}"
            else:
                input_data['prompt'] = f"[Voice input]: {transcribed_text}"
            
            print(f"Audio transcribed: {transcribed_text}", file=sys.stderr)
            
            # Mark that we had audio input for the main system
            input_data['had_audio'] = True
            
            # Remove audio data to prevent further processing
            if 'audio' in input_data:
                del input_data['audio']
            if 'audioBuffer' in input_data:
                del input_data['audioBuffer']
        else:
            # Fallback message if Whisper is not available
            input_data['prompt'] = input_data.get('prompt', '') + "\n\n[Note: Audio was received but could not be transcribed offline. Please install Whisper dependencies for offline speech-to-text.]"
            input_data['had_audio'] = True
    
    return input_data


def main():
    """
    Main function for standalone usage or integration testing.
    """
    if len(sys.argv) > 1 and sys.argv[1] == '--test-integration':
        # Test integration with sample data
        test_data = {
            'prompt': 'Hello, this is a test',
            'audio': None,  # Would contain base64 audio in real usage
            'images': [],
            'messages': []
        }
        
        result = integrate_with_existing_system(test_data)
        print("Integration test result:", result)
    else:
        # Run standalone Whisper STT
        from whisper_stt import main as whisper_main
        whisper_main()


if __name__ == "__main__":
    main()