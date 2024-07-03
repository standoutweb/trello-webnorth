import express from 'express';
import router from './routes/routes.js';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

const corsOptions = {
	origin: ['http://localhost:3000', 'https://webnorth-internal.netlify.app'], // Allowed origins
	optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
	methods: 'GET,POST,PUT,DELETE,OPTIONS',
	allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept'
};

// Use CORS with the specified options
app.use(cors(corsOptions));

app.use('/api/', router);

const port = process.env.PORT || 3000;

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
