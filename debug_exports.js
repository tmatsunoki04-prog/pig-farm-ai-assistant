try {
    const genai = require('@google/genai');
    console.log('Keys of @google/genai:', Object.keys(genai));
    if (genai.Client) console.log('Client export exists');
    if (genai.GoogleGenAI) console.log('GoogleGenAI export exists');
    if (genai.createClient) console.log('createClient export exists');
    
    // Check nested keys if it is a default export
    if (genai.default) {
        console.log('Default export keys:', Object.keys(genai.default));
    }
} catch (e) {
    console.log('Error requiring @google/genai (likely not installed locally):', e.message);
}
