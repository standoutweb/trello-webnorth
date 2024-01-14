// YOUR_BASE_DIRECTORY/netlify/functions/api.ts

import express, {Router} from "express";
import serverless from "serverless-http";

const SECRET_TOKEN = process.env.AUTH;
const Trello = require('trello');
const trello = new Trello(process.env.KEY, process.env.TOKEN)

const api = express();

const router = Router();
router.get("/hello", async (req, res) => res.send("Hello World!"));
router.get('/boards', async (req, res) => {
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

router.get('/boards/:boardId/cards', async (req, res) => {
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
router.get('/cards/:cardId/actions', async (req, res) => {
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

api.use("/api/", router);

export const handler = serverless(api);