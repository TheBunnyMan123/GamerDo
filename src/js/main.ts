import { openDB, IDBPDatabase, IDBPTransaction } from "idb";
import { v4 as uuidv4 } from 'uuid';

const $ = document.querySelector.bind(document);

async function openDatabase() {
   return await openDB("database", 2, {
      async upgrade(db: IDBPDatabase<unknown>, oldVersion, newVersion, transaction) {
         async function createStores() {
            const pendingStore = db.createObjectStore("pending", {
               keyPath: "uuid"
            });
            const completedStore = db.createObjectStore("completed", {
               keyPath: "uuid"
            });
            const abandonedStore = db.createObjectStore("abandoned", {
               keyPath: "uuid"
            });
            const miscStore = db.createObjectStore("misc", {
               keyPath: "id"
            });

            await miscStore.add({value: 0, id: "points"});

            return {misc: miscStore, abandoned: abandonedStore, completed: completedStore, pending: pendingStore};
         }

         if (oldVersion < 1) {
            await createStores();
         } else if (oldVersion < 2) {
            const updateData = {} as any;

            console.log(transaction, transaction.store)
            for (const storeName of transaction.objectStoreNames) {
               let _store = transaction.objectStore(storeName)
               updateData[storeName] = await _store.getAll();
               db.deleteObjectStore(storeName);
            }

            let stores = await createStores();

            for (const storeName in stores) {
               let _store = stores[storeName as "misc"|"abandoned"|"completed"|"pending"];
               if (_store) {
                  let recordList = updateData[storeName == "pending" ? "tasks": storeName];
                  for (const recordId in recordList) {
                     const record = recordList[recordId];

                     if (record.name) {
                        await _store.add({uuid: uuidv4(), task: record.task, points: record.points})
                     } else {
                        await _store.add(record);
                     }
                  }
      
                  await transaction.done;
               }
            }
         }
      }
   });
}

async function addPoints(amount: number) {
   const db = await openDatabase();

   const transaction = db.transaction("misc", "readwrite");
   const store = transaction.store;

   amount = parseInt(amount.toString());

   if (isNaN(parseInt((await store.get("points")).value))) {
      store.put({value: amount, id: "points"});
   } else {
      store.put({value: parseInt((await store.get("points")).value) + amount, id: "points"});
   }

   updateCounters();
}

async function updateCounters() {
   const db = await openDatabase();

   const misc = db.transaction("misc", "readonly");
   $("#points").innerText = (await misc.store.get("points")).value;

   const pending = db.transaction("pending", "readonly");
   $("#pending").innerText = (await pending.store.count());
   
   const completed = db.transaction("completed", "readonly");
   $("#completed").innerText = (await completed.store.count());
   
   const abandoned = db.transaction("abandoned", "readonly");
   $("#abandoned").innerText = (await abandoned.store.count());
}

async function createTask(task: string, points: number, storeTask: Boolean = true, state: ("pending"|"abandoned"|"completed") = "pending", uuid = uuidv4()) {
   if (storeTask) {
      const db = await openDatabase();
      const transaction = db.transaction("pending", "readwrite");
      const store = transaction.store

      store.add({task: task, points: points, uuid: uuid});
   }

   let newTaskElement = document.createElement("div");
   newTaskElement.className = "task";

   let newTaskNameElement = document.createElement("span");
   newTaskNameElement.className = "taskname text";
   newTaskNameElement.innerText = task;

   let newTaskPointsElement = document.createElement("span");
   newTaskPointsElement.className = "points text";
   newTaskPointsElement.innerText = `${points} Points`;

   if (state == "pending") {
      let completeButton  = document.createElement("button");
      let abandonButton  = document.createElement("button");

      completeButton.className = "create";
      abandonButton.className = "cancel";
      completeButton.style.fontSize = "1em";
      abandonButton.style.fontSize = "1em";

      completeButton.innerText =  "Complete";
      completeButton.addEventListener("click", async (event: Event) => {
         const db = await openDatabase();
         let pending = db.transaction("pending", "readwrite").store;
         pending.delete(uuid);

         let completed = db.transaction("completed", "readwrite").store;
         completed.add({task: task, points: points, uuid: uuid})

         addPoints(points);

         $("#completedtasks").appendChild(newTaskElement);
         completeButton.remove();
         abandonButton.remove();
      })

      abandonButton.innerText =  "Abandon";
      abandonButton.addEventListener("click", async (event: Event) => {
         const db = await openDatabase();
         let pending = db.transaction("pending", "readwrite").store;
         pending.delete(uuid);

         let abandoned = db.transaction("abandoned", "readwrite").store;
         abandoned.add({task: task, points: points, uuid: uuid})

         addPoints(-Math.round(points/2));
         
         newTaskElement.remove();
         createTask(task, points, false, "abandoned", uuid);
      })

      newTaskElement.appendChild(newTaskNameElement);
      newTaskElement.appendChild(document.createElement("br"));
      newTaskElement.appendChild(newTaskPointsElement);
      newTaskElement.appendChild(completeButton);
      newTaskElement.appendChild(abandonButton);
   } else if (state == "abandoned") {
      let completeButton  = document.createElement("button");
      let abandonButton  = document.createElement("button");

      completeButton.className = "create";
      abandonButton.className = "cancel";
      completeButton.style.fontSize = "1em";
      abandonButton.style.fontSize = "1em";

      completeButton.innerText = "Reinstate";
      completeButton.addEventListener("click", async (event: Event) => {
         const db = await openDatabase();
         let abandoned = db.transaction("abandoned", "readwrite").store;
         abandoned.delete(uuid);
         addPoints(Math.round(points / 2));
         newTaskElement.remove();

         createTask(task, points, true, "pending", uuid);
      })

      newTaskElement.appendChild(newTaskNameElement);
      newTaskElement.appendChild(document.createElement("br"));
      newTaskElement.appendChild(newTaskPointsElement);
      newTaskElement.appendChild(completeButton);
   } else {
      newTaskElement.appendChild(newTaskNameElement);
      newTaskElement.appendChild(document.createElement("br"));
      newTaskElement.appendChild(newTaskPointsElement);
   }
   $(`#${state}tasks`).appendChild(newTaskElement);
   console.log("Created Task!");
}

updateCounters();

$("#newbutton").addEventListener("click", (event: Event) => {
   $("#newtaskdialog").className = "dialog visible";
})

$("#newtaskdialog .cancel").addEventListener("click", (event: Event) => {
   $("#newtaskdialog").className = "dialog";
})
$("#newtaskdialog .create").addEventListener("click", (event: Event) => {
   $("#newtaskdialog").className = "dialog";
   createTask($("#newtaskname").value, $("#newtaskpoints").value);
})

$("#showpending").addEventListener("click", (event: Event) => {
   $("#pendingtasks").style.display = "flex";
   $("#completedtasks").style.display = "none";
   $("#abandonedtasks").style.display = "none";

   $("#showpending").className = "selected";
   $("#showcompleted").className = "";
   $("#showabandoned").className = "";
});
$("#showcompleted").addEventListener("click", (event: Event) => {
   $("#pendingtasks").style.display = "none";
   $("#completedtasks").style.display = "flex";
   $("#abandonedtasks").style.display = "none";

   $("#showpending").className = "";
   $("#showcompleted").className = "selected";
   $("#showabandoned").className = "";
});
$("#showabandoned").addEventListener("click", (event: Event) => {
   $("#pendingtasks").style.display = "none";
   $("#completedtasks").style.display = "none";
   $("#abandonedtasks").style.display = "flex";

   $("#showpending").className = "";
   $("#showcompleted").className = "";
   $("#showabandoned").className = "selected";
});

function downloadFile(content: string, name: string) {
   const blob = new Blob([content], { type: 'application/json' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = name;
   document.body.appendChild(a);
   a.click();
   document.body.removeChild(a);
   URL.revokeObjectURL(url);
}

$("#exportbutton").addEventListener("click", async () => {
   const db = await openDatabase();
   const exportData = {} as any;

   for (const storeName of db.objectStoreNames) {
      exportData[storeName] = await db.getAll(storeName);
   }

   db.close();
   downloadFile(JSON.stringify(exportData), 'GamerDo_Export.json');
});

let importFile = document.createElement("input");
importFile.accept = "application/json";
importFile.type = "file";
importFile.addEventListener("change", async () => {
   const db = await openDatabase();
   const reader = new FileReader();
   try {
      const importData = JSON.parse(await importFile.files[0].text());

      for (const storeName of db.objectStoreNames) {
         (db.transaction(storeName, "readwrite")).store.clear();
      }

      for (const storeName in importData) {
         if (db.objectStoreNames.contains(storeName)) {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.store;
            
            for (const record of importData[storeName]) {
               await store.add(record);
            }

            await transaction.done;
         }
      }

      window.location.reload()
   } catch (error) {
      console.error(error);
      throw error;
   }
})

$("#importbutton").addEventListener("click", () => {
   importFile.click();
});

(async () => {
   const db = await openDatabase();
   console.log(db);
   for await (let task of db.transaction("pending").store.iterate()) {
      let val = task.value
      createTask(val.task, parseInt(val.points.toString()), false, "pending")
   }

   for await (let task of db.transaction("completed").store.iterate()) {
      let val = task.value
      createTask(val.task, parseInt(val.points.toString()), false, "completed")
   }

   for await (let task of db.transaction("abandoned").store.iterate()) {
      let val = task.value
      createTask(val.task, parseInt(val.points.toString()), false, "abandoned")
   }
})();
