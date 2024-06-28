import express from 'express';
import router from './routes/routes.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use('/api/', router);

const port = process.env.PORT || 3000;

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
