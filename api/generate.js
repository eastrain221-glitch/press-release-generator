import { google } from 'googleapis';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) throw new Error('API 오류');
    const data = await response.json();
    const result = data.content?.[0]?.text || '';

    // Google Sheets 기록
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const type = req.body.messages?.[0]?.content?.slice(0, 20) || '';
      const source = req.body.system?.slice(0, 100) || '';

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'Sheet1!A:D',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            new Date().toLocaleString('ko-KR'),
            req.body.type || '',
            req.body.messages?.[0]?.content?.slice(0, 500) || '',
            result.slice(0, 500)
          ]]
        }
      });
    } catch (sheetErr) {
      console.error('Sheets 기록 오류:', sheetErr);
    }

    res.status(200).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
