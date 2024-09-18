import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

let endRow = 0;
let endRowOverall = 0;
export async function connectToSpreadsheet(pageName = 'Daily stats') {
	try {
		const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('ascii'));
		const auth = new GoogleAuth({
			credentials: credentials,
			scopes: ['https://www.googleapis.com/auth/spreadsheets'],
		});
		const client = await auth.getClient();
		console.log('Connected to Google Sheets');
		const sheets = google.sheets({ version: 'v4', auth: client });
		const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
		let range = `'${pageName}'!A1:ZZZ`;
		let dataResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range });
		let values = dataResponse.data.values || [];
		let startRow = 1;
		if(pageName === 'Overall stats') {
			if (endRowOverall === 0) {
				endRowOverall = values.length;
			}
			while (endRowOverall > startRow && values[endRowOverall - 1] && !values[endRowOverall - 1].some(cell => cell.trim() !== '')) {
				endRowOverall--;
			}
			return { spreadsheetId, endRowOverall, sheets };
		} else {
			if (endRow === 0) {
				endRow = values.length;
			}
			while (endRow > startRow && values[endRow - 1] && !values[endRow - 1].some(cell => cell.trim() !== '')) {
				endRow--;
			}
			return { spreadsheetId, endRow, sheets };
		}
	} catch (error) {
		console.error('Error connecting to Google Sheets:', error);
		throw error;
	}
}

export async function saveDataToSpreadsheet(sheetRange, values, pageName = 'Daily stats') {
	let endRow = 0;
	const result = await connectToSpreadsheet(pageName);
	await new Promise(resolve => setTimeout(resolve, 1000));
	const spreadsheetId = result.spreadsheetId;
	if(pageName === 'Overall stats') {
		endRow = result.endRowOverall;
	} else {
		endRow = result.endRow;
	}
	const sheets = result.sheets;

	let nextEmptyRow = endRow + 1;
	let range = `'${pageName}'!${sheetRange}${nextEmptyRow}`;
	const request = {
		spreadsheetId,
		range,
		valueInputOption: 'RAW',
		resource: {
			values: [[...values]]
		}
	};

	return await sheets.spreadsheets.values.update(request);
}
