<script>
    const netlifyIdentity = require('netlify-identity-widget');
    import { onMount } from 'svelte';

    // Initialize Netlify Identity
    netlifyIdentity.init();

    let boards = [];
    let lastRefreshed = '';
    let selectedBoard = null;
    let selectedCard = null;
    let cards = [];
    let actions = [];
    let netlify_url = 'https://webnorth-internal.netlify.app/api/'

    onMount(async () => {
        await loadBoards();
    });

    async function makeAuthRequest(url) {
        const user = netlifyIdentity.currentUser();
        const jwtToken = user ? await user.jwt() : null;

        const headers = new Headers();
        if (jwtToken) {
            headers.append("Authorization", `Bearer ${jwtToken}`);
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    async function loadBoards() {
        const url = `${netlify_url}/boards`;
        try {
            boards = await makeAuthRequest(url);
            boards.sort((a, b) => new Date(b.dateLastActivity) - new Date(a.dateLastActivity));

            localStorage.setItem('boards', JSON.stringify(boards));
            lastRefreshed = new Date().toISOString();
            localStorage.setItem('lastRefreshed', lastRefreshed);
        } catch (error) {
            console.error('Error loading boards:', error);
        }
    }

    async function loadCards(boardId) {
        const url = `${netlify_url}/boards/${boardId}/cards`;
        try {
            cards = await makeAuthRequest(url);
            cards.sort((a, b) => new Date(b.dateLastActivity) - new Date(a.dateLastActivity));
        } catch (error) {
            console.error('Error loading cards:', error);
        }
    }

    async function loadCardActions(cardId) {
        const url = `${netlify_url}/cards/${cardId}/actions`;
        try {
            actions = await makeAuthRequest(url);
            actions.sort((a, b) => new Date(b.date) - new Date(a.date));
        } catch (error) {
            console.error('Error loading card actions:', error);
        }
    }

    async function refreshBoards() {
        const url = `${netlify_url}/boards`;
        try {
            boards = await makeAuthRequest(url);
            boards.sort((a, b) => new Date(b.dateLastActivity) - new Date(a.dateLastActivity));

            localStorage.setItem('boards', JSON.stringify(boards));
            lastRefreshed = new Date().toISOString();
            localStorage.setItem('lastRefreshed', lastRefreshed);
        } catch (error) {
            console.error('Error refreshing boards:', error);
        }
    }

    function handleBoardClick(board) {
        selectedBoard = board;
        loadCards(board.id);
    }

    function handleCardClick(card) {
        selectedCard = card;
        loadCardActions(card.id);
    }

    function closeDrawer() {
        selectedBoard = null;
        cards = [];
    }

    function closeCardDrawer() {
        selectedCard = null;
    }

    function convertDate(date) {
        // ... existing convertDate function
    }
</script>

<div class="d-flex gap-20 justify-between p-10 align-center">
    {#if lastRefreshed}
        <span>Last refreshed: {convertDate(lastRefreshed)}</span>
    {/if}
    <a class="btn btn-primary" on:click={refreshBoards}>Refresh</a>
    <a class="btn btn-primary" on:click={() => netlifyIdentity.open('login')}>Log In</a>
</div>

<div class="d-flex gap-20 justify-between p-10 bg-black text-white">
    <div>Board Name</div>
    <div>Latest Activity</div>
</div>
{#each boards as board}
    <div class="d-flex gap-20 justify-between bb-1 p-10">
        <a on:click={() => handleBoardClick(board)} target="_blank">{board.name}</a>
        <div class="text-right d-flex shrink-0">{convertDate(board.dateLastActivity)}</div>
    </div>
{/each}

{#if selectedBoard}
    <div class="drawer cards">
        <a class="btn btn-primary p-fixed r-5 t-5 text-small" on:click={closeDrawer}>Close</a>
        <h3>{selectedBoard.name} Cards</h3>
        {#each cards as card}
            <div class="pt-10 pb-10 bb-1 d-flex direction-column">
                <a class="word-break" on:click={handleCardClick(card)} target="_blank">{card.name}</a>
                <span class="text-small">Latest Activity: {convertDate(card.dateLastActivity)}</span>
            </div>
        {/each}
    </div>
{/if}

{#if selectedCard}
    <div class="drawer actions">
        <a class="btn btn-primary p-fixed r-5 t-5 text-small" on:click={closeCardDrawer}>← Back</a>

        <a class="word-break" href="{selectedCard.shortUrl}" target="_blank"><h3>{selectedCard.name}</h3></a>
        <span class="card-description">{selectedCard.desc}</span>
        <div class="mt-20">
            {#if actions && actions.length > 0}
                {#each actions as action}
                    <div class="pt-10 pb-10 bb-1 d-flex direction-column">
                        <span class="text-small mb-10">{action.type}</span>
                        {#if action.data.listAfter && action.data.listAfter.name}
                            <span class="text-small mb-10">Moved to: {action.data.listAfter.name}</span>
                        {/if}
                        {#if action.data.text && action.data.text.length > 0}
                            <span class="text-small mb-10">{action.data.text}</span>
                        {/if}
                        <span class="text-small">{action.memberCreator.fullName} on {convertDate(action.date)}</span>
                    </div>
                {/each}
            {:else}
                <div class="pt-10 pb-10 bb-1 d-flex direction-column">
                    <span>No actions found, this might be a new card</span>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    body {
        padding: unset !important;
    }

    .d-flex {
        display: flex;
    }

    .gap-20 {
        gap: 20px;
    }

    .justify-between {
        justify-content: space-between;
    }

    .mb-10 {
        margin-bottom: 10px;
    }

    .bb-1 {
        border-bottom: 1px solid #ccc;
    }

    .p-10 {
        padding: 10px;
    }

    .bg-black {
        background-color: #000;
    }

    .text-white {
        color: #fff;
    }

    p-0 {
        padding: 0;
    }

    .btn {
        padding: 10px;
        border-radius: 5px;
        cursor: pointer;
    }

    .btn-primary {
        background-color: #0079bf;
        color: #fff;
    }

    .align-center {
        align-items: center;
    }

    .drawer {
        position: fixed;
        right: 0;
        top: 0;
        width: auto;
        max-width: 700px;
        height: 100%;
        background-color: white;
        box-shadow: -2px 0 5px rgba(0, 0, 0, 0.2);
        padding: 10px;
        overflow-y: auto;
    }

    .text-small {
        font-size: 12px;
    }

    .direction-column {
        flex-direction: column;
    }

    .p-absolute {
        position: absolute;
    }

    .r-10 {
        right: 10px;
    }

    .r-5 {
        right: 5px;
    }

    .t-5 {
        top: 5px;
    }

    .p-fixed {
        position: fixed;
    }

    .word-break {
        word-break: break-all;
    }

    .text-right {
        text-align: right;
    }

    .shrink-0 {
        flex-shrink: 0;
    }

    .pt-10 {
        padding-top: 10px;
    }

    .pb-10 {
        padding-bottom: 10px;
    }

    .mt-20 {
        margin-top: 20px;
    }

    span {
        word-break: break-word;
    }

</style>
