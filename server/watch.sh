fswatch -o src | xargs -n1 -I{} esr src/server.ts
