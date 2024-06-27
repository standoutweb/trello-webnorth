// /netlify/functions/api.js
import express from 'express';
import serverless from 'serverless-http';
import router from './routes';

const api = express();
api.use('/api/', router);

exports.handler = serverless(api, {
	request: (req, event, context) => {
		req.context = context;
	},
});