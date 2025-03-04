// import fastq from 'fastq'
// declare module 'fastq' {
//   interface queue<T = any, R = any> {
//     fakemethod(): void
//     /** Add a task at the end of the queue. `done(err, result)` will be called when the task was processed. */
//     push(task: T, done?: done<R>): void
//   }

//   interface queueAsPromised<T = any, R = any> extends queue<T, R> {
//     /** Add a task at the end of the queue. The returned `Promise` will be fulfilled (rejected) when the task is completed successfully (unsuccessfully). */
//     push(task: T): Promise<R>
//     // ...
//   }
// }

declare global {
  type FooBar = [foo: string, bar: number]
}

export {}
