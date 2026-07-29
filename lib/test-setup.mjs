// Titik masuk `npm test`: daftarkan hook resolusi lewat API register() resmi.
// (`--experimental-loader` sudah ditandai akan dihapus.)
import { register } from "node:module";
register("./test-resolver.mjs", import.meta.url);
