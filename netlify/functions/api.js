const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

const SECRET_TOKEN = process.env.AUTH;
const Trello = require('trello');
const trello = new Trello(process.env.KEY, process.env.TOKEN);

// CORS configuration
const corsOptions = {
    origin: 'http://localhost:8080', // Update with your Svelte app's URL in production
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Define your routes
app.get('/', (req, res) => res.send('Hello World!'));
app.get('/boards', async (req, res) => {
    try {

        if (req.query.auth !== SECRET_TOKEN) {
            return res.status(401).send('Unauthorized');
        }

        const boards = await trello.getBoards('me');
        res.json(boards);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});
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
app.get('/boards/:boardId/cards', async (req, res) => {
    try {

        if (req.query.auth !== SECRET_TOKEN) {
            return res.status(401).send('Unauthorized');
        }

        const cards = await trello.getCardsOnBoard(req.params.boardId);
        res.json(cards);

    } catch (error) {
        res.status(500).send(error.toString());
    }
});


// Wrap the Express app with serverless-http
module.exports.handler = serverless(app);
