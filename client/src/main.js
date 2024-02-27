import { Router, Route } from 'svelte-routing';
import App from './routes/App.svelte';
import BoardList from './routes/BoardList.svelte';
import Paymo from './routes/Paymo.svelte';

const app = new App({
	target: document.body
});

export default app;
