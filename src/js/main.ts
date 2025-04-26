import { openDB, deleteDB, wrap, unwrap, IDBPDatabase } from "idb";

const $ = document.querySelector.bind(document);

async function openDatabase() {
   return await openDB("database", 1, {
      async upgrade(db: IDBPDatabase<unknown>) {
         const tasksStore = db.createObjectStore("tasks", {
            keyPath: "tasks",
            autoIncrement: true
         })
         const completedStore = db.createObjectStore("completed", {
            keyPath: "completed",
            autoIncrement: true
         })
         const miscStore = db.createObjectStore("misc", {
            keyPath: "id"
         })

         await miscStore.add({value: 0, id: "points"});
      }
   });
}

async function addPoints(amount: Number) {
   const db = await openDatabase();

   const transaction = db.transaction("misc", "readwrite");
   const store = transaction.store;

   if (isNaN((await store.get("points")).value)) {
      store.put({value: amount, id: "points"});
   } else {
      store.put({value: (await store.get("points")).value + amount, id: "points"});
   }

   updateCounters();
}

async function updateCounters() {
   const db = await openDatabase();

   const misc = db.transaction("misc", "readonly");
   $("#points").innerText = (await misc.store.get("points")).value;

   const tasks = db.transaction("misc", "readonly");
   $("#pending").innerText = (await tasks.store.count() - 1);
   
   const completed = db.transaction("misc", "readonly");
   $("#completed").innerText = (await completed.store.count() - 1);
}

updateCounters();
