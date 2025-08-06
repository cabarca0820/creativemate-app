#!/usr/bin/env python3
"""
Offline Speech-to-Text using OpenAI's Whisper Model
==================================================

A complete implementation for offline speech recognition that works without internet connection.
Supports real-time microphone input and audio file processing.

Installation Requirements:
--------------------------
pip install openai-whisper
pip install pyaudio
pip install pydub
pip install numpy

For macOS users, you might need:
brew install portaudio
brew install ffmpeg

For Ubuntu/Debian users:
sudo apt update
sudo apt install portaudio19-dev python3-pyaudio ffmpeg

For Windows users:
Download and install FFmpeg from https://ffmpeg.org/download.html
"""

import os
import sys
import json
import time
import wave
import threading
import argparse
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta

try:
    import whisper
    import pyaudio
    import numpy as np
    from pydub import AudioSegment
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"Missing dependencies: {e}")
    print("Please install required packages:")
    print("pip install openai-whisper pyaudio pydub numpy")
    DEPENDENCIES_AVAILABLE = False
    sys.exit(1)

class WhisperSTT:
    """
    Offline Speech-to-Text processor using OpenAI's Whisper model.
    """
    
    # Available Whisper models with their characteristics
    MODELS = {
        'tiny': {'size': '~39 MB', 'speed': 'fastest', 'accuracy': 'lowest'},
        'base': {'size': '~74 MB', 'speed': 'fast', 'accuracy': 'good'},
        'small': {'size': '~244 MB', 'speed': 'medium', 'accuracy': 'better'},
        'medium': {'size': '~769 MB', 'speed': 'slow', 'accuracy': 'high'},
        'large': {'size': '~1550 MB', 'speed': 'slowest', 'accuracy': 'highest'}
    }
    
    def __init__(self, model_size: str = 'base', device: str = 'cpu'):
        """
        Initialize the Whisper STT processor.
        
        Args:
            model_size (str): Whisper model size ('tiny', 'base', 'small', 'medium', 'large')
            device (str): Device to run on ('cpu' or 'cuda')
        """
        self.model_size = model_size
        self.device = device
        self.model = None
        self.is_recording = False
        self.audio_frames = []
        
        # Audio recording parameters
        self.sample_rate = 16000  # Whisper expects 16kHz
        self.chunk_size = 1024
        self.channels = 1
        self.format = pyaudio.paInt16
        
        self.pyaudio_instance = None
        self.stream = None
        
        # print(f"Initializing Whisper STT with model: {model_size}")
        self._load_model()
    
    def _load_model(self):
        """Load the Whisper model."""
        try:
            # print(f"Loading Whisper model '{self.model_size}'...")
            # print(f"Model info: {self.MODELS.get(self.model_size, 'Unknown model')}")
            
            # Load model (will download if not cached)
            self.model = whisper.load_model(self.model_size, device=self.device)
            # print(f"✓ Model '{self.model_size}' loaded successfully")
            
        except Exception as e:
            # print(f"✗ Error loading Whisper model: {e}")
            raise
    
    def _setup_audio(self):
        """Setup PyAudio for recording."""
        try:
            self.pyaudio_instance = pyaudio.PyAudio()
            
            # Check if microphone is available
            device_count = self.pyaudio_instance.get_device_count()
            if device_count == 0:
                raise Exception("No audio devices found")
            
            # Find default input device
            default_device = self.pyaudio_instance.get_default_input_device_info()
            print(f"Using microphone: {default_device['name']}")
            
            return True
            
        except Exception as e:
            print(f"✗ Error setting up audio: {e}")
            return False
    
    def start_recording(self):
        """Start recording audio from microphone."""
        if not self._setup_audio():
            return False
        
        try:
            self.stream = self.pyaudio_instance.open(
                format=self.format,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.chunk_size
            )
            
            self.is_recording = True
            self.audio_frames = []
            
            print("🎤 Recording started... Press Ctrl+C to stop")
            
            # Start recording in a separate thread
            self.recording_thread = threading.Thread(target=self._record_audio)
            self.recording_thread.daemon = True
            self.recording_thread.start()
            
            return True
            
        except Exception as e:
            print(f"✗ Error starting recording: {e}")
            return False
    
    def _record_audio(self):
        """Record audio in a separate thread."""
        try:
            while self.is_recording:
                data = self.stream.read(self.chunk_size, exception_on_overflow=False)
                self.audio_frames.append(data)
                
        except Exception as e:
            print(f"✗ Error during recording: {e}")
            self.is_recording = False
    
    def stop_recording(self) -> Optional[str]:
        """
        Stop recording and transcribe the audio.
        
        Returns:
            str: Transcribed text or None if error
        """
        if not self.is_recording:
            print("No active recording to stop")
            return None
        
        print("🛑 Stopping recording...")
        self.is_recording = False
        
        # Wait for recording thread to finish
        if hasattr(self, 'recording_thread'):
            self.recording_thread.join(timeout=2.0)
        
        # Clean up audio stream
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        
        if self.pyaudio_instance:
            self.pyaudio_instance.terminate()
        
        if not self.audio_frames:
            print("No audio data recorded")
            return None
        
        # Convert recorded audio to format suitable for Whisper
        try:
            # Combine all audio frames
            audio_data = b''.join(self.audio_frames)
            
            # Convert to numpy array
            audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
            
            print("🔄 Transcribing audio...")
            start_time = time.time()
            
            # Transcribe using Whisper
            result = self.model.transcribe(audio_np, language=None)  # Auto-detect language
            
            end_time = time.time()
            transcription_time = end_time - start_time
            
            transcribed_text = result['text'].strip()
            detected_language = result.get('language', 'unknown')
            
            # print(f"✓ Transcription completed in {transcription_time:.2f}s")
            # print(f"✓ Detected language: {detected_language}")
            # print(f"✓ Transcribed text: {transcribed_text}")
            
            return transcribed_text
            
        except Exception as e:
            print(f"✗ Error during transcription: {e}")
            return None
    
    def transcribe_file(self, file_path: str, include_timestamps: bool = False) -> Optional[Dict[str, Any]]:
        """
        Transcribe an audio file.
        
        Args:
            file_path (str): Path to the audio file
            include_timestamps (bool): Whether to include word-level timestamps
            
        Returns:
            dict: Transcription result with text, language, and optionally timestamps
        """
        if not os.path.exists(file_path):
            print(f"✗ File not found: {file_path}")
            return None
        
        try:
            # print(f"🔄 Transcribing file: {file_path}")
            start_time = time.time()
            
            # Transcribe the file
            if include_timestamps:
                result = self.model.transcribe(file_path, word_timestamps=True)
            else:
                result = self.model.transcribe(file_path)
            
            end_time = time.time()
            transcription_time = end_time - start_time
            
            transcribed_text = result['text'].strip()
            detected_language = result.get('language', 'unknown')
            
            # print(f"✓ File transcription completed in {transcription_time:.2f}s")
            print(f"✓ Detected language: {detected_language}")
            print(f"✓ Transcribed text: {transcribed_text}")
            
            return {
                'text': transcribed_text,
                'language': detected_language,
                'duration': transcription_time,
                'segments': result.get('segments', []) if include_timestamps else None
            }
            
        except Exception as e:
            print(f"✗ Error transcribing file: {e}")
            return None
    
    def batch_transcribe(self, file_paths: List[str], output_dir: str = None) -> List[Dict[str, Any]]:
        """
        Transcribe multiple audio files in batch.
        
        Args:
            file_paths (List[str]): List of audio file paths
            output_dir (str): Directory to save transcription results (optional)
            
        Returns:
            List[Dict]: List of transcription results
        """
        results = []
        
        for i, file_path in enumerate(file_paths, 1):
            print(f"\n📁 Processing file {i}/{len(file_paths)}: {os.path.basename(file_path)}")
            
            result = self.transcribe_file(file_path, include_timestamps=True)
            if result:
                result['file_path'] = file_path
                result['file_name'] = os.path.basename(file_path)
                results.append(result)
                
                # Save individual result if output directory specified
                if output_dir:
                    os.makedirs(output_dir, exist_ok=True)
                    output_file = os.path.join(
                        output_dir, 
                        f"{Path(file_path).stem}_transcription.json"
                    )
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
                    print(f"✓ Saved transcription to: {output_file}")
                else:
                    print(f"✗ Failed to saving transcribe: {file_path}")
            else:
                print(f"✗ Failed to transcribe: {file_path}")
        
        return results
    
    def get_model_info(self) -> Dict[str, str]:
        """Get information about the current model."""
        return {
            'model_size': self.model_size,
            'device': self.device,
            **self.MODELS.get(self.model_size, {})
        }
    
    def cleanup(self):
        """Clean up resources."""
        if self.is_recording:
            self.stop_recording()
        
        if self.stream:
            self.stream.close()
        
        if self.pyaudio_instance:
            self.pyaudio_instance.terminate()


def print_model_options():
    """Print available Whisper model options."""
    print("\n📋 Available Whisper Models:")
    print("=" * 50)
    for model, info in WhisperSTT.MODELS.items():
        print(f"{model:8} | Size: {info['size']:10} | Speed: {info['speed']:8} | Accuracy: {info['accuracy']}")
    print("=" * 50)
    print("💡 Recommendation: Use 'base' for good balance of speed and accuracy")
    print("💡 Use 'tiny' for fastest processing on slower devices")
    print("💡 Use 'small' or 'medium' for better accuracy if you have time")
    print()


def interactive_mode():
    """Run the script in interactive mode."""
    print("\n🎯 Whisper Offline Speech-to-Text")
    print("=" * 40)
    
    # Model selection
    print_model_options()
    
    while True:
        model_choice = input("Choose model size (tiny/base/small/medium/large) [base]: ").strip().lower()
        if not model_choice:
            model_choice = 'base'
        
        if model_choice in WhisperSTT.MODELS:
            break
        else:
            print(f"Invalid model choice. Please choose from: {', '.join(WhisperSTT.MODELS.keys())}")
    
    # Initialize Whisper STT
    try:
        stt = WhisperSTT(model_size=model_choice)
        model_info = stt.get_model_info()
        print(f"\n✓ Using model: {model_info['model_size']} ({model_info['size']}, {model_info['accuracy']} accuracy)")
        
    except Exception as e:
        print(f"✗ Failed to initialize Whisper: {e}")
        return
    
    while True:
        print("\n🎛️  Choose an option:")
        print("1. Record from microphone")
        print("2. Transcribe audio file")
        print("3. Batch transcribe multiple files")
        print("4. Change model")
        print("5. Exit")
        
        choice = input("\nEnter your choice (1-5): ").strip()
        
        if choice == '1':
            # Live recording
            try:
                if stt.start_recording():
                    input("\n⏸️  Press Enter to stop recording...")
                    transcription = stt.stop_recording()
                    
                    if transcription:
                        print(f"\n📝 Transcription Result:")
                        print("-" * 30)
                        print(f"{transcription}")
                        print("-" * 30)
                        
                        # Save option
                        save = input("\n💾 Save transcription to file? (y/n): ").strip().lower()
                        if save == 'y':
                            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                            filename = f"transcription_{timestamp}.txt"
                            with open(filename, 'w', encoding='utf-8') as f:
                                f.write(f"Transcription Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                                f.write(f"Model Used: {model_choice}\n")
                                f.write(f"Text: {transcription}\n")
                            print(f"✓ Saved to: {filename}")
                    else:
                        print("✗ No transcription generated")
                else:
                    print("✗ Failed to start recording")
                    
            except KeyboardInterrupt:
                print("\n🛑 Recording interrupted")
                stt.stop_recording()
            except Exception as e:
                print(f"✗ Recording error: {e}")
        
        elif choice == '2':
            # File transcription
            file_path = input("\n📁 Enter audio file path: ").strip().strip('"\'')
            
            if not file_path:
                print("✗ No file path provided")
                continue
            
            include_timestamps = input("Include timestamps? (y/n) [n]: ").strip().lower() == 'y'
            
            result = stt.transcribe_file(file_path, include_timestamps)
            
            if result:
                print(f"\n📝 Transcription Result:")
                print("-" * 50)
                print(f"File: {os.path.basename(file_path)}")
                print(f"Language: {result['language']}")
                print(f"Duration: {result['duration']:.2f}s")
                print(f"Text: {result['text']}")
                
                if include_timestamps and result['segments']:
                    print(f"\n⏱️  Timestamps:")
                    for segment in result['segments']:
                        start = str(timedelta(seconds=int(segment['start'])))
                        end = str(timedelta(seconds=int(segment['end'])))
                        print(f"[{start} - {end}] {segment['text']}")
                
                print("-" * 50)
                
                # Save option
                save = input("\n💾 Save transcription to file? (y/n): ").strip().lower()
                if save == 'y':
                    output_file = f"{Path(file_path).stem}_transcription.json"
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
                    print(f"✓ Saved to: {output_file}")
            else:
                print("✗ Failed to transcribe file")
        
        elif choice == '3':
            # Batch transcription
            input_dir = input("\n📁 Enter directory path containing audio files: ").strip().strip('"\'')
            
            if not os.path.isdir(input_dir):
                print("✗ Invalid directory path")
                continue
            
            # Find audio files
            audio_extensions = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.wma'}
            audio_files = []
            
            for file_path in Path(input_dir).rglob('*'):
                if file_path.suffix.lower() in audio_extensions:
                    audio_files.append(str(file_path))
            
            if not audio_files:
                print(f"✗ No audio files found in: {input_dir}")
                continue
            
            print(f"📁 Found {len(audio_files)} audio files")
            for i, file_path in enumerate(audio_files, 1):
                print(f"  {i}. {os.path.basename(file_path)}")
            
            proceed = input(f"\n🚀 Proceed with batch transcription? (y/n): ").strip().lower()
            if proceed != 'y':
                continue
            
            output_dir = input("📁 Enter output directory for results [./transcriptions]: ").strip()
            if not output_dir:
                output_dir = "./transcriptions"
            
            print(f"\n🔄 Starting batch transcription...")
            results = stt.batch_transcribe(audio_files, output_dir)
            
            print(f"\n✓ Batch transcription completed!")
            print(f"✓ Processed: {len(results)}/{len(audio_files)} files")
            print(f"✓ Results saved to: {output_dir}")
        
        elif choice == '4':
            # Change model
            print_model_options()
            new_model = input("Choose new model size: ").strip().lower()
            
            if new_model in WhisperSTT.MODELS:
                try:
                    stt.cleanup()
                    stt = WhisperSTT(model_size=new_model)
                    print(f"✓ Switched to model: {new_model}")
                except Exception as e:
                    print(f"✗ Failed to switch model: {e}")
            else:
                print(f"✗ Invalid model choice")
        
        elif choice == '5':
            # Exit
            print("\n👋 Goodbye!")
            stt.cleanup()
            break
        
        else:
            print("✗ Invalid choice. Please enter 1-5.")


def command_line_mode(args):
    """Run the script in command-line mode."""
    try:
        stt = WhisperSTT(model_size=args.model, device=args.device)
        
        if args.file:
            # Transcribe single file
            result = stt.transcribe_file(args.file, args.timestamps)
            if result:
                if args.output:
                    with open(args.output, 'w', encoding='utf-8') as f:
                        if args.json:
                            json.dump(result, f, indent=2, ensure_ascii=False)
                        else:
                            f.write(result['text'])
                    print(f"✓ Transcription saved to: {args.output}")
                else:
                    print(result['text'])
            else:
                sys.exit(1)
        
        elif args.batch:
            # Batch transcription
            audio_extensions = {'.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac', '.wma'}
            audio_files = []
            
            for file_path in Path(args.batch).rglob('*'):
                if file_path.suffix.lower() in audio_extensions:
                    audio_files.append(str(file_path))
            
            if not audio_files:
                print(f"✗ No audio files found in: {args.batch}")
                sys.exit(1)
            
            output_dir = args.output or "./transcriptions"
            results = stt.batch_transcribe(audio_files, output_dir)
            print(f"✓ Processed {len(results)}/{len(audio_files)} files")
        
        else:
            # Live recording
            print("🎤 Starting live recording mode...")
            if stt.start_recording():
                try:
                    input("⏸️  Press Enter to stop recording...")
                except KeyboardInterrupt:
                    pass
                
                transcription = stt.stop_recording()
                if transcription:
                    if args.output:
                        with open(args.output, 'w', encoding='utf-8') as f:
                            f.write(transcription)
                        print(f"✓ Transcription saved to: {args.output}")
                    else:
                        print(transcription)
                else:
                    sys.exit(1)
            else:
                print("✗ Failed to start recording")
                sys.exit(1)
        
        stt.cleanup()
        
    except Exception as e:
        print(f"✗ Error: {e}")
        sys.exit(1)


def main():
    """Main function with argument parsing."""
    parser = argparse.ArgumentParser(
        description="Offline Speech-to-Text using OpenAI's Whisper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python whisper_stt.py                          # Interactive mode
  python whisper_stt.py --file audio.wav         # Transcribe single file
  python whisper_stt.py --batch ./audio_files    # Batch transcribe directory
  python whisper_stt.py --model small --live     # Live recording with small model
  python whisper_stt.py --file audio.mp3 --output result.txt --timestamps
        """
    )
    
    parser.add_argument('--model', '-m', 
                       choices=list(WhisperSTT.MODELS.keys()), 
                       default='base',
                       help='Whisper model size (default: base)')
    
    parser.add_argument('--device', '-d', 
                       choices=['cpu', 'cuda'], 
                       default='cpu',
                       help='Device to run on (default: cpu)')
    
    parser.add_argument('--file', '-f', 
                       type=str,
                       help='Audio file to transcribe')
    
    parser.add_argument('--batch', '-b', 
                       type=str,
                       help='Directory containing audio files for batch processing')
    
    parser.add_argument('--output', '-o', 
                       type=str,
                       help='Output file path')
    
    parser.add_argument('--timestamps', '-t', 
                       action='store_true',
                       help='Include word-level timestamps')
    
    parser.add_argument('--json', '-j', 
                       action='store_true',
                       help='Output in JSON format')
    
    parser.add_argument('--live', '-l', 
                       action='store_true',
                       help='Live recording mode')
    
    parser.add_argument('--list-models', 
                       action='store_true',
                       help='List available models and exit')
    
    args = parser.parse_args()
    
    if not DEPENDENCIES_AVAILABLE:
        print("✗ Required dependencies not available")
        sys.exit(1)
    
    if args.list_models:
        print_model_options()
        return
    
    # If no specific mode is chosen, run interactive mode
    if not any([args.file, args.batch, args.live]):
        interactive_mode()
    else:
        command_line_mode(args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        sys.exit(1)