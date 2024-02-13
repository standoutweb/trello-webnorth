<script>
    import {onMount} from 'svelte';

    let netlify_url = 'http://localhost:3000';
    let actions = [];

    onMount(async () => {
        let before = '2024-01-31T00:00:00Z';
        let after = '2024-01-30T00:00:00Z';
        console.log(before);
        console.log(after);
        await loadActions(before, after);
                console.log(before);
                console.log(after);
    });

    async function loadActions(before, after) {
        const url = `${netlify_url}/me/actions/${before}/${after}`;
        const response = await fetch(url);
        actions = await response.json();
        return actions;
    }

</script>

{#each actions as action}
    {#if action.memberCreator.fullName === "Emrah Lekiq"}
        <div class="action">
            <span class="text-small">{action.date} - {action.type} - {action.memberCreator.fullName}</span><br>
            <a href="https://trello.com/c/{action.data.card.shortLink}">{action.data.card.name}</a>
        </div>
    {/if}
{/each}

<style>
    .action {
        border: 1px solid black;
        margin: 10px;
        padding: 10px;
    }

    .text-small {
        font-size: 10px;
    }
</style>