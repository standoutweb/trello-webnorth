import express, {Router} from "express";
import serverless from "serverless-http";
import Trello from "trello"

const trello = new Trello(process.env.KEY, process.env.TOKEN);
const api = express();
const router = Router();

// Middleware to check for authenticated user
const requireAuth = (req, res, next) => {
    if (!req.context || !req.context.clientContext || !req.context.clientContext.user) {
        return res.status(401).send('Unauthorized');
    }
    next();
};

// Apply the middleware to your routes
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

api.use("/api/", router);

// Modify the handler to include the context
exports.handler = serverless(api, {
    request: (req, event, context) => {
        req.context = context;
    },
});
