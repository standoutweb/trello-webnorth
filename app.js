require('dotenv').config();

const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;
const SECRET_TOKEN = process.env.AUTH;

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

        if (req.query.auth !== SECRET_TOKEN) {
            return res.status(401).send('Unauthorized');
        }

        const boards = await trello.getBoards('me');
        res.json(boards);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});
// get cards from a board

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

app.listen(port, () => console.log('App listening at http://localhost:${port}'));