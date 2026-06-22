import { syncDrive } from "../drive/sync.js";

const files = await syncDrive();
console.log(`Sincronização concluída: ${files} ficheiros suportados.`);
