// todo: reuse routes with netlify functions

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// CORS configuration
// Replace the origin with the URL of your Svelte app in production
const corsOptions = {
    origin: 'http://localhost:8080', // The port where your Svelte app is running
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

const Trello = require('trello');
const PAYMO_API_BASE_URL = "https://app.paymoapp.com/api";
const axios = require("axios");
const trello = new Trello(process.env.KEY, process.env.TOKEN)

app.get('/', (req, res) => res.send('Hello World!'));

app.get('/boards', async (req, res) => {
    try {
        const boards = await trello.getBoards('me');
        res.json(boards);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});
// get cards from a board

app.get('/boards/:boardId/cards', async (req, res) => {
    try {
        const cards = await trello.getCardsOnBoard(req.params.boardId);
        res.json(cards);

    } catch (error) {
        res.status(500).send(error.toString());
    }
});

// get card actions
app.get('/cards/:cardId/actions', async (req, res) => {
    try {
        const actions = await trello.getActionsOnCard(req.params.cardId);
        res.json(actions);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.get('/paymo/timelogs', async (req, res) => {
    let { startDate, endDate } = req.query;

    // Calculate last week's dates if startDate and endDate are not provided
    if (!startDate || !endDate) {
        const today = new Date();
        const pastDay = new Date(today.setDate(today.getDate() - today.getDay() - 6)); // Get the date for last week's start (assuming Sunday as the first day of the week)
        const lastWeekStart = new Date(pastDay.setDate(pastDay.getDate() - pastDay.getDay()));
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);

        // Format dates as YYYY-MM-DD
        startDate = lastWeekStart.toISOString().split('T')[0];
        endDate = lastWeekEnd.toISOString().split('T')[0];
    }

    const username = process.env.PAYMO_API_KEY;
    const password = 'random'; // Use a random password as specified
    const basicAuth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');

    try {
        const response = await axios.get(`${PAYMO_API_BASE_URL}/entries`, {
            headers: { Authorization: basicAuth },
            params: {
                where: `time_interval in ("${startDate}","${endDate}")`
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

app.listen(port, () => console.log('App listening at http://localhost:${port}'));