import express from 'express';
import router from './routes/routes.js';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

const allowedOrigins = ['http://localhost:3000', 'https://webnorth-internal.netlify.app'];

const corsOptionsDelegate = (req, callback) => {
	let corsOptions;
	const origin = req.header('Origin');
	if (allowedOrigins.includes(origin)) {
		corsOptions = {
			origin: origin,
			optionsSuccessStatus: 200,
			methods: 'GET,POST,PUT,DELETE,OPTIONS',
			allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-User-Email,X-User-Id' // Include Authorization
		};
	} else {
		corsOptions = { origin: false }; // Disable CORS for this request
	}
	callback(null, corsOptions); // Callback expects two parameters: error and options
};

app.use(cors(corsOptionsDelegate));

app.use('/api/', router);

const port = process.env.PORT || 3000;

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
