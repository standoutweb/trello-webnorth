<script>
  import { onMount } from 'svelte';

  let netlify_url = 'http://localhost:3000';
  let projects = []; // This will hold the structured data for rendering

  onMount(async () => {
    let before = '2024-02-09T00:00:00Z';
    let after = '2024-02-08T00:00:00Z';
    await loadActions(before, after);
  });

  async function loadActions(before, after) {
    const url = `${netlify_url}/me/actions/${before}/${after}`;
    const response = await fetch(url);
    const actions = await response.json();

    let groupedActions = new Map(); // Group by project name

    actions.forEach(action => {
      if (action.memberCreator.fullName === "Emrah Lekiq") {
        if (action.data && action.data.card && action.data.card.name) {
          console.log(action.data.card.name, action.type, action.date)
          const [projectName, cardName] = action.data.card.name.split(': ');
          const shortLink = action.data.card.shortLink; // Get the shortLink

          if (!groupedActions.has(projectName)) {
            groupedActions.set(projectName, new Map()); // Initialize inner map for cards
          }

          let cardsMap = groupedActions.get(projectName);
          if (!cardsMap.has(cardName)) {
            cardsMap.set(cardName, {
              actions: new Set(), // Use a Set to avoid duplicate actions
              date: action.date, // Store the last action date for simplicity
              shortLink // Store the shortLink
            });
          }

          let cardInfo = cardsMap.get(cardName);
          cardInfo.actions.add(action.type); // Add action type
        }
      }
    });
    // Convert groupedActions to an array for Svelte reactivity
    projects = Array.from(groupedActions.entries()).map(([projectName, cardsMap]) => ({
      projectName,
      cards: Array.from(cardsMap.entries()).map(([cardName, { actions, date, shortLink }]) => ({
        cardName,
        actions: Array.from(actions).join(', '), // Convert action types Set to string
        date, // Assuming you want to display the last action date
        shortLink // Include the shortLink for each card
      }))
    }));
  }


</script>

{#each projects as { projectName, cards }}
  <div class="project">
    <strong>{projectName}:</strong>
    <ul>
      {#each cards as { cardName, actions, date, shortLink }}
        <li>
          <a href={`https://trello.com/c/${shortLink}`} target="_blank">{cardName}</a>
          <small style="user-select: none;">{actions}</small>
        </li>
      {/each}
    </ul>
  </div>
{/each}

<style>
  .project {
    margin-bottom: 20px;
  }
  ul {
    margin-top: 5px;
    padding-left: 20px;
  }
  li {
    margin-bottom: 5px;
  }
</style>
