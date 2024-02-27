import express, { Router } from "express";
import serverless from "serverless-http";
import Trello from "trello";
import axios from "axios"; // Ensure axios is installed for making HTTP requests

const trello = new Trello(process.env.KEY, process.env.TOKEN);
const PAYMO_API_BASE_URL = "https://app.paymoapp.com/api";
const api = express();
const router = Router();

router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000'); // Or '*' for any origin
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Middleware to check for authenticated user
const requireAuth = (req, res, next) => {

    if (process.env.NODE_ENV === 'development') {
        console.log(process.env.KEY, process.env.TOKEN, process.env.PAYMO_API_KEY);
        return next();
    }

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

router.get('/paymo/timelogs', requireAuth, async (req, res) => {
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

api.use("/api/", router);

exports.handler = serverless(api, {
    request: (req, event, context) => {
        req.context = context;
    },
});
