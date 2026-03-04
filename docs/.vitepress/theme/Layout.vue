<script setup>
import DefaultTheme from "vitepress/theme";
import { onMounted, watch, nextTick } from "vue";
import { useRoute, useData, withBase } from "vitepress";

const { Layout } = DefaultTheme;
const route = useRoute();
const { isDark } = useData();

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
  <Layout>
    <template #nav-bar-title-before>
      <div class="nav-logo-wrap">
        <img
          class="nav-logo-img"
          :src="isDark ? withBase('/logo-dark.svg') : withBase('/logo.svg')"
          alt="Medipal"
        />
        <span class="nav-dev-badge">Developer</span>
      </div>
    </template>
  </Layout>
</template>
