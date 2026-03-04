<script setup>
import DefaultTheme from "vitepress/theme";
import { onMounted, watch, nextTick } from "vue";
import { useRoute } from "vitepress";

const { Layout } = DefaultTheme;
const route = useRoute();

function wrapTables() {
  document.querySelectorAll(".vp-doc table").forEach((table) => {
    if (table.parentElement?.classList.contains("vp-table-wrap")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "vp-table-wrap";
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

onMounted(wrapTables);
watch(
  () => route.path,
  () => nextTick(wrapTables),
);
</script>

<template>
  <Layout />
</template>
