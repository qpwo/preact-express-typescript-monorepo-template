fswatch -o src | xargs -n1 -I{} esr server.ts
