// todo: reuse routes with netlify functions

require('dotenv').config();
const axios = require('axios');


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

        if (req.query.auth !== SECRET_TOKEN) {
            return res.status(401).send('Unauthorized');
        }

        const actions = await trello.getActionsOnCard(req.params.cardId);
        res.json(actions);

    } catch (error) {
        res.status(500).send(error.toString());
    }
});

app.get('/me/actions/:before/:after', async (req, res) => {
    try {

        // Extracting the before and after parameters
        const { before, after } = req.params;

        // Trello API URL
        const url = `https://api.trello.com/1/members/me/actions?key=${process.env.KEY}&token=${process.env.TOKEN}&before=${before}&since=${after}&limit=1000`;

        // Making the request to the Trello API
        const response = await axios.get(url);
        const actions = response.data;

        // Sending the actions as response
        res.json(actions);

    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});
app.listen(port, () => console.log('App listening at http://localhost:3000'));