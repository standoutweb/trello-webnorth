import express, { Router } from "express";
import serverless from "serverless-http";
import Trello from "trello";
import axios from "axios"; // Ensure axios is installed for making HTTP requests
const { GoogleAuth } = require( 'google-auth-library' );
const { google } = require( 'googleapis' );

const trello = new Trello( process.env.KEY, process.env.TOKEN );
const PAYMO_API_BASE_URL = "https://app.paymoapp.com/api";
const api = express();
const router = Router();

router.use( ( req, res, next ) => {
	res.header( 'Access-Control-Allow-Origin', 'http://localhost:3000' ); // Or '*' for any origin
	res.header( 'Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept' );
	next();
} );

// Middleware to check for authenticated user
const requireAuth = ( req, res, next ) => {
	// If the secret query parameter is provided and matches the SECRET_QUERY_PARAM_VALUE, bypass the usual authentication
	if ( req.query.secret && req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE ) {
		return next();
	}

	if ( process.env.NODE_ENV === 'development' ) {
		return next();
	}

	if ( ! req.context || ! req.context.clientContext || ! req.context.clientContext.user ) {
		return res.status( 401 ).send( 'Unauthorized' );
	}

	if ( req.query.secret && req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE ) {
		return next();
	}

	next();
};

// Existing Trello integration routes
router.get( '/boards', requireAuth, async ( req, res ) => {
	try {
		const boards = await trello.getBoards( 'me' );
		res.json( boards );
	} catch ( error ) {
		res.status( 500 ).send( error.toString() );
	}
} );

router.get( '/boards/:boardId/cards', requireAuth, async ( req, res ) => {
	try {
		const cards = await trello.getCardsOnBoard( req.params.boardId );
		res.json( cards );
	} catch ( error ) {
		res.status( 500 ).send( error.toString() );
	}
} );

router.get( '/cards/:cardId/actions', requireAuth, async ( req, res ) => {
	try {
		const actions = await trello.getActionsOnCard( req.params.cardId );
		res.json( actions );
	} catch ( error ) {
		res.status( 500 ).send( error.toString() );
	}
} );

router.get( '/paymo/timelogs', requireAuth, async ( req, res ) => {
	let { startDate, endDate } = req.query;

	// Calculate last week's dates if startDate and endDate are not provided
	if ( ! startDate || ! endDate ) {
		const today = new Date();
		const pastDay = new Date( today.setDate( today.getDate() - today.getDay() - 6 ) ); // Get the date for last week's start (assuming Sunday as the first day of the week)
		const lastWeekStart = new Date( pastDay.setDate( pastDay.getDate() - pastDay.getDay() ) );
		const lastWeekEnd = new Date( lastWeekStart );
		lastWeekEnd.setDate( lastWeekEnd.getDate() + 6 );

		// Format dates as YYYY-MM-DD
		startDate = lastWeekStart.toISOString().split( 'T' )[ 0 ];
		endDate = lastWeekEnd.toISOString().split( 'T' )[ 0 ];
	}

	const username = process.env.PAYMO_API_KEY;
	const password = 'random'; // Use a random password as specified
	const basicAuth = 'Basic ' + Buffer.from( username + ':' + password ).toString( 'base64' );

	try {
		const response = await axios.get( `${ PAYMO_API_BASE_URL }/entries`, {
			headers: { Authorization: basicAuth },
			params: {
				where: `time_interval in ("${ startDate }","${ endDate }")`
			}
		} );
		res.json( response.data );
	} catch ( error ) {
		console.error( error );
		res.status( 500 ).send( error.toString() );
	}
} );

router.get( '/paymo/timelogs/:weekNumber', requireAuth, async ( req, res ) => {
	// todo for lazzar, let's make this flexible to get the hours worked on a specific week
} );

// SEND TO GOOGLE SHEETS
router.get( '/google/:weekNumber/:timeInSeconds', requireAuth, async ( req, res ) => {
	const timeInSeconds = req.params.timeInSeconds;
	const weekNumber = req.params.weekNumber;
	const hours = Math.floor( timeInSeconds / 3600 );
	const minutes = Math.floor( ( timeInSeconds % 3600 ) / 60 );
	try {
		const credentials = JSON.parse( Buffer.from( process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64' ).toString( 'ascii' ) );
		const auth = new GoogleAuth( {
			credentials: credentials,
			scopes: [ 'https://www.googleapis.com/auth/spreadsheets' ],
		} );
		const client = await auth.getClient();
		const sheets = google.sheets( { version: 'v4', auth: client } );

		const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
		let range = 'Sheet1!A1:ZZZ';
		let dataResponse = await sheets.spreadsheets.values.get( { spreadsheetId, range } );
		let values = dataResponse.data.values;

		if ( ! values || ! values.length ) {
			range = `Sheet1!A1:B1`;
			const titleRequest = {
				spreadsheetId,
				range,
				valueInputOption: 'RAW',
				resource: {
					values: [ [ `Week #`, `Time` ] ]
				}
			};
			const titleResponse = await sheets.spreadsheets.values.update( titleRequest );

			dataResponse = await sheets.spreadsheets.values.get( { spreadsheetId, range } );
			values = dataResponse.data.values;
		}

		let startRow = 1;
		let endRow = values.length;
		while ( endRow > startRow && ! values[ endRow - 1 ].some( cell => cell.trim() !== '' ) ) {
			endRow--;
		}

		let nextEmptyRow = endRow + 1;
		range = `Sheet1!A${ nextEmptyRow }`;
		const request = {
			spreadsheetId,
			range,
			valueInputOption: 'RAW',
			resource: {
				values: [ [ `Week ${ weekNumber }`, `${ hours } hours ${ minutes } minutes` ] ]
			}
		};


		const response = await sheets.spreadsheets.values.update( request );
		res.json( response.data );
	} catch ( error ) {
		console.error( error );
		res.status( 500 ).send( error.toString() );
	}
} );

// SEND TO SLACK CHANNEL
router.get( '/slack', async ( req, res ) => {
	try {
		const response = await axios.post( process.env.SLACK_WEBHOOK_URL, {
			text: 'Hello from Netlify Functions!',
		} );
		res.json( response.data );
	} catch ( error ) {
		console.error( error );
		res.status( 500 ).send( error.toString() );
	}
} );

// HELPER API ROUTES

// get current week number
router.get( '/current-week', async ( req, res ) => {

	function getWeekNumber( d ) {
		d = new Date( Date.UTC( d.getFullYear(), d.getMonth(), d.getDate() ) );
		d.setUTCDate( d.getUTCDate() + 4 - ( d.getUTCDay() || 7 ) );
		const yearStart = new Date( Date.UTC( d.getUTCFullYear(), 0, 1 ) );
		const weekNo = Math.ceil( ( ( ( d - yearStart ) / 86400000 ) + 1 ) / 7 );
		return weekNo;
	}


	const today = new Date();
	const weekNumber = getWeekNumber( today );
	res.json( { weekNumber } );
} );

// get hours worked on specific week and specific board
router.get( '/boards/:boardId/:weekNumber/time-spent', async ( req, res ) => {
	const { boardId, weekNumber } = req.params;
	const date = new Date( new Date().getFullYear(), 0, 1 );
	date.setDate( weekNumber * 7 );
	const lastWeekEnd = new Date( date );
	const lastWeekStart = new Date( lastWeekEnd );

	lastWeekEnd.setDate( lastWeekEnd.getDate() - 1 );
	lastWeekStart.setDate( lastWeekStart.getDate() - 6 );

	const startDate = lastWeekStart.toISOString().split( 'T' )[ 0 ];
	const endDate = lastWeekEnd.toISOString().split( 'T' )[ 0 ];
	const username = process.env.PAYMO_API_KEY;
	const password = 'random'; // Use a random password as specified
	const basicAuth = 'Basic ' + Buffer.from( username + ':' + password ).toString( 'base64' );

	try {

		let secretToken
		// check if params include secret, if not continue with normal auth
		if ( req.query.secret === process.env.SECRET_QUERY_PARAM_VALUE ) {
			secretToken = process.env.SECRET_QUERY_PARAM_VALUE; // Make sure to store your secret token in your environment variables
			console.log( 'secret passed to /boards/:boardId/:weekNumber/time-spent' );
		}

		const entries = await axios.get( `${ PAYMO_API_BASE_URL }/entries`, {
			headers: { Authorization: basicAuth },
			params: {
				where: `time_interval in ("${ startDate }","${ endDate }")`
			}
		} );

		console.log( 'entries from paymo successfully fetched' );


		axios.get( `${ process.env.API_URL }/boards/${ boardId }/cards`, {
			params: {
				secret: secretToken
			}
		} ).then( ( response ) => {
			const shortLinks = response.data.map( item => item.shortLink );
			const filteredEntries = entries.data.entries.filter( entry =>
				shortLinks.some( shortLink => entry.description.includes( shortLink ) )
			);
			const totalDuration = filteredEntries.reduce( ( total, entry ) => total + entry.duration, 0 );
			res.json( totalDuration );

		} );

		console.log( 'total duration successfully fetched' )

	} catch ( error ) {
		console.error( error );
		res.status( 500 ).send( error.toString() );
	}
} )

router.get( '/last-week-hours-daily-send-to-sheets', async ( req, res ) => {
	const secretToken = process.env.SECRET_QUERY_PARAM_VALUE; // Make sure to store your secret token in your environment variables

	if ( ! req.query.secret || req.query.secret !== secretToken ) {
		return res.status( 401 ).send( 'Unauthorized' );
	}

	axios.get( `${ process.env.API_URL }/current-week` ).then( ( response ) => {
		const lastWeek = response.data.weekNumber - 1;
		const boardId = process.env.DAILY_BOARD_ID;
		axios.get( `${ process.env.API_URL }/boards/${ boardId }/${ lastWeek }/time-spent`, {
			params: {
				secret: process.env.SECRET_QUERY_PARAM_VALUE
			}
		} ).then( ( response ) => {
			const timeInSeconds = response.data;
			axios.get( `${ process.env.API_URL }/google/${ lastWeek }/${ timeInSeconds }/`, {
				params: {
					secret: process.env.SECRET_QUERY_PARAM_VALUE
				}
			} ).then( ( response ) => {
				res.json( response.data );
			} );
		} )
	} )

} );

api.use( "/api/", router );

exports.handler = serverless( api, {
	request: ( req, event, context ) => {
		req.context = context;
	},
} );
