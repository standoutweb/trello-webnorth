<script>
	import BoardList from './BoardList.svelte';
	import MeActivity from "./MeActivity.svelte";
	import OrganisedActivity from "./OrganisedActivity.svelte";

	let selected = '';

	const handleSelectBoard = (e) => {
		selected = 'board';
	}

	const handleSelectActivity = (e) => {
		selected = 'activity';
	}

	const handleSelectOrganised = (e) => {
		selected = 'organised';
		console.log(selected);
	}
</script>

<main>
	<aside>
		<button on:click={handleSelectBoard} value="board">Board</button>
		<button on:click={handleSelectActivity} value="activity">Activity</button>
		<button on:click={handleSelectOrganised} value="organised">Organised</button>
	</aside>
	{#if selected === 'board'}
		<BoardList />
	{/if}
	{#if selected === 'activity'}
		<MeActivity />
	{/if}
	{#if selected === 'organised'}
		<OrganisedActivity />
	{/if}
</main>