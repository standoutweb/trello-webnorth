<script>
    import {Router, Link, Route} from 'svelte-routing';
    import BoardList from './BoardList.svelte';
	import Paymo from './Paymo.svelte';
</script>

<Router>
	<nav>
		<Link to="/paymo/">Paymo</Link>
	</nav>

	<main>
		<Route path="/paymo/" component="{Paymo}" />
	</main>
</Router>

<style>
	nav {
		display: flex;
		padding: 10px;
		gap: 20px;
	}
</style>

<BoardList />