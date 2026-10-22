let input = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const request = JSON.parse(input);

  if (request.document_to_ingest) {
    process.stdout.write('Document indexed locally');
    return;
  }

  if (request.audio_to_transcribe) {
    process.stdout.write('Transcribed requirement');
    return;
  }

  const output = request.skill === 'document_creation' ? '# Lean document' : 'QA analysis';
  const midpoint = Math.ceil(output.length / 2);
  process.stdout.write(`data: ${JSON.stringify({ type: 'chunk', content: output.slice(0, midpoint) })}\n\n`);
  process.stdout.write(`data: ${JSON.stringify({ type: 'chunk', content: output.slice(midpoint) })}\n\n`);
});
