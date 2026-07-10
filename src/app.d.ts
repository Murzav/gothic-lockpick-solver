// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}

    // adapter-cloudflare exposes the worker's bindings to endpoints as
    // `platform.env`. Only the D1 counter binding is declared here.
    interface Platform {
      env: {
        DB: import("@cloudflare/workers-types").D1Database;
      };
    }
  }
}

export {};
