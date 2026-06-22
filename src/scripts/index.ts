import { buildLocalIndex } from "../indexer/build.js";

const index = await buildLocalIndex();
console.log(`Indexação concluída: ${index.materials.length} ficheiros, ${index.chunks.length} excertos.`);
