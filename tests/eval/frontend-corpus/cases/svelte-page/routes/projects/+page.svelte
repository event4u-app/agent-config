<script>
  export let projects = [];
</script>

<ul class="divide-y divide-slate-200">
  {#each projects as p}
    <li class="py-2">{p.name}</li>
  {/each}
</ul>
