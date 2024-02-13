import express, { Router } from "express";
import serverless from "serverless-http";
import Trello from "trello";
import axios from "axios"; // Ensure axios is installed for making HTTP requests

const trello = new Trello(process.env.KEY, process.env.TOKEN);
const PAYMO_API_BASE_URL = "https://api.paymoapp.com";
const api = express();
const router = Router();

// Middleware to check for authenticated user
const requireAuth = (req, res, next) => {
    if (!req.context || !req.context.clientContext || !req.context.clientContext.user) {
        return res.status(401).send('Unauthorized');
    }
    next();
};

// Existing Trello integration routes
router.get('/boards', requireAuth, async (req, res) => {
    try {
        const boards = await trello.getBoards('me');
        res.json(boards);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

router.get('/boards/:boardId/cards', requireAuth, async (req, res) => {
    try {
        const cards = await trello.getCardsOnBoard(req.params.boardId);
        res.json(cards);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

router.get('/cards/:cardId/actions', requireAuth, async (req, res) => {
    try {
        const actions = await trello.getActionsOnCard(req.params.cardId);
        res.json(actions);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

// Paymo time loggings feature
router.get('/paymo/timelogs', requireAuth, async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).send('Missing startDate or endDate query parameters');
    }

    try {
        const response = await axios.get(`${PAYMO_API_BASE_URL}/entries`, {
            headers: { Authorization: `Bearer ${process.env.PAYMO_API_KEY}` },
            params: {
                where: `start_date>=${startDate} and end_date<=${endDate}`
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).send(error.toString());
    }
});

api.use("/api/", router);

exports.handler = serverless(api, {
    request: (req, event, context) => {
        req.context = context;
    },
});
