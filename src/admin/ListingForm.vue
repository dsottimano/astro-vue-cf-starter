<script setup lang="ts">
import { watch } from 'vue';
import type { ListingFormModel } from './model';
import { slugify } from './model';

// ─────────────────────────────────────────────────────────────────────────────
// THE business-specific form (Approach B). Copy + rewrite the fields per
// business. Every input maps 1:1 to a field in src/content.config.ts.
// Image uploads are delegated up to AdminApp via the `upload` callback.
// ─────────────────────────────────────────────────────────────────────────────

const model = defineModel<ListingFormModel>({ required: true });

const props = defineProps<{
  upload: (file: File, prefix: 'photos' | 'floorplans') => Promise<string>;
}>();

// Auto-fill slug + translationKey from the title until the user overrides slug.
let slugTouched = false;
watch(
  () => model.value.title,
  (title) => {
    if (!slugTouched) {
      const s = slugify(title);
      model.value.slug = s;
      if (!model.value.translationKey) model.value.translationKey = s;
    }
  },
);

async function onFiles(e: Event, prefix: 'photos' | 'floorplans') {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;
  for (const file of Array.from(input.files)) {
    const key = await props.upload(file, prefix);
    model.value[prefix].push(key);
  }
  input.value = '';
}

function addFeature() {
  model.value.features.push('');
}
function removeFeature(i: number) {
  model.value.features.splice(i, 1);
}
function removeImage(prefix: 'photos' | 'floorplans', i: number) {
  model.value[prefix].splice(i, 1);
}
</script>

<template>
  <div class="form">
    <fieldset>
      <legend>Basics</legend>
      <label>Title<input v-model="model.title" type="text" /></label>
      <label
        >Slug
        <input v-model="model.slug" type="text" @input="slugTouched = true" />
      </label>
      <label>Translation key<input v-model="model.translationKey" type="text" /></label>
      <div class="row">
        <label
          >Status
          <select v-model="model.status">
            <option value="draft">Draft</option>
            <option value="for-sale">For sale</option>
            <option value="pending">Pending</option>
            <option value="sold">Sold</option>
          </select>
        </label>
        <label class="check"><input v-model="model.featured" type="checkbox" /> Featured</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Price & type</legend>
      <div class="row">
        <label>Price<input v-model.number="model.price" type="number" min="0" /></label>
        <label>Currency<input v-model="model.currency" type="text" /></label>
        <label
          >Type
          <select v-model="model.propertyType">
            <option value="house">House</option>
            <option value="condo">Condo</option>
            <option value="lot">Lot</option>
            <option value="commercial">Commercial</option>
          </select>
        </label>
      </div>
      <div class="row">
        <label>Beds<input v-model.number="model.beds" type="number" min="0" /></label>
        <label>Baths<input v-model.number="model.baths" type="number" min="0" /></label>
        <label>Area<input v-model.number="model.area" type="number" min="0" /></label>
        <label
          >Unit
          <select v-model="model.areaUnit">
            <option value="sqft">sqft</option>
            <option value="sqm">sqm</option>
          </select>
        </label>
        <label>Lot size<input v-model.number="model.lotSize" type="number" min="0" /></label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Address</legend>
      <div class="row">
        <label>Street<input v-model="model.address.street" type="text" /></label>
        <label>City<input v-model="model.address.city" type="text" /></label>
        <label>Region<input v-model="model.address.region" type="text" /></label>
        <label>Country<input v-model="model.address.country" type="text" /></label>
      </div>
      <div class="row">
        <label>Lat<input v-model.number="model.coords.lat" type="number" step="any" /></label>
        <label>Lng<input v-model.number="model.coords.lng" type="number" step="any" /></label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Features</legend>
      <div v-for="(_, i) in model.features" :key="i" class="row">
        <input v-model="model.features[i]" type="text" />
        <button type="button" @click="removeFeature(i)">✕</button>
      </div>
      <button type="button" @click="addFeature">+ Add feature</button>
    </fieldset>

    <fieldset>
      <legend>Photos</legend>
      <ul class="keys">
        <li v-for="(key, i) in model.photos" :key="key">
          <code>{{ key }}</code>
          <button type="button" @click="removeImage('photos', i)">✕</button>
        </li>
      </ul>
      <input type="file" accept="image/*" multiple @change="onFiles($event, 'photos')" />
    </fieldset>

    <fieldset>
      <legend>Floorplans</legend>
      <ul class="keys">
        <li v-for="(key, i) in model.floorplans" :key="key">
          <code>{{ key }}</code>
          <button type="button" @click="removeImage('floorplans', i)">✕</button>
        </li>
      </ul>
      <input
        type="file"
        accept="image/*,application/pdf"
        multiple
        @change="onFiles($event, 'floorplans')"
      />
    </fieldset>

    <fieldset>
      <legend>Description (markdown)</legend>
      <textarea v-model="model.description" rows="8"></textarea>
    </fieldset>
  </div>
</template>

<style scoped>
.form {
  display: grid;
  gap: 1.25rem;
}
fieldset {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem;
}
legend {
  font-weight: 600;
  padding: 0 0.4rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
}
.row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: flex-end;
}
.row > label {
  flex: 1;
  min-width: 8rem;
}
.check {
  flex-direction: row;
  align-items: center;
}
input,
select,
textarea {
  font: inherit;
  padding: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 0.3rem;
  background: var(--color-bg);
  color: var(--color-fg);
}
.keys {
  list-style: none;
  padding: 0;
  margin: 0 0 0.5rem;
  display: grid;
  gap: 0.25rem;
}
.keys li {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: center;
}
</style>
