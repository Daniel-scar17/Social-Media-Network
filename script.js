import { db } from "./firebase.js";
import { defaultSocialData } from "./data.js";
import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let socialData = {};
let selectedNodeId = null;
let currentPerson = null;

const cy = cytoscape({
    container:document.getElementById("cy"),
    elements:[],
    style:[
        {
            selector:"node",
            style:{
                "background-color":"data(color)",
                "label":"data(label)",
                "text-valign":"center",
                "text-halign":"center",
                "color":"#222",
                "width":65,
                "height":65
            }
        },
        {
            selector:"edge",
            style:{
                "width":5,
                "curve-style":"bezier",
                "line-color":"#ccc"
            }
        },
        {
            selector:'edge[platform="Facebook"]',
            style:{"line-color":"#1877F2"}
        },
        {
            selector:'edge[platform="Instagram"]',
            style:{"line-color":"#C13584"}
        },
        {
            selector:'edge[platform="TikTok"]',
            style:{"line-color":"#000"}
        },
        {
            selector:'edge[platform="X"]',
            style:{"line-color":"#777"}
        },
        {
            selector:"node.highlighted",
            style:{
                "background-color":"#2ecc71",
                "border-width":4,
                "border-color":"#27ae60"
            }
        }
    ]
});

function makeId(name){
    return name.toLowerCase().trim().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}

function cleanPersonName(name){
    return name.trim();
}

async function loadAllData(){
    socialData = {};
    const querySnapshot = await getDocs(collection(db,"socials"));

    querySnapshot.forEach(item=>{
        socialData[item.id] = item.data().platforms || {};
    });

    if(Object.keys(socialData).length === 0){
        socialData = structuredClone(defaultSocialData);
        await saveAllData(false);
    }

    loadSocialFolders();
    document.getElementById("details").innerHTML = "Search a person or open a saved social folder.";
}

async function savePerson(person){
    await setDoc(doc(db,"socials",person),{
        platforms:socialData[person] || {}
    });
}

async function saveAllData(showAlert=true){
    for(let person in socialData){
        await savePerson(person);
    }

    loadSocialFolders();

    if(showAlert){
        alert("Data saved online.");
    }
}

function addToPlatform(person, platform, friend){
    if(!socialData[person]){
        socialData[person] = {};
    }

    if(!socialData[person][platform]){
        socialData[person][platform] = [];
    }

    if(!socialData[person][platform].includes(friend)){
        socialData[person][platform].push(friend);
    }
}

async function addSocialConnection(){
    const person = cleanPersonName(document.getElementById("mainPerson").value);
    const friend = cleanPersonName(document.getElementById("connectedPerson").value);
    const platform = document.getElementById("platform").value;

    if(!person || !friend){
        alert("Complete the fields.");
        return;
    }

    if(person.toLowerCase() === friend.toLowerCase()){
        alert("A person cannot connect to themselves.");
        return;
    }

    addToPlatform(person, platform, friend);
    addToPlatform(friend, platform, person);

    await savePerson(person);
    await savePerson(friend);

    currentPerson = person;
    buildGraph(person);
    loadSocialFolders();

    document.getElementById("mainPerson").value = "";
    document.getElementById("connectedPerson").value = "";
}

function buildGraph(person){
    cy.elements().remove();

    if(!socialData[person]){
        document.getElementById("details").innerHTML = "No saved data for " + person;
        return;
    }

    const nodes = new Map();
    const edges = [];

    nodes.set(makeId(person),{
        data:{
            id:makeId(person),
            label:person
        }
    });

    for(let platform in socialData[person]){
        socialData[person][platform].forEach(friend=>{
            nodes.set(makeId(friend),{
                data:{
                    id:makeId(friend),
                    label:friend
                }
            });

            edges.push({
                data:{
                    id:makeId(person)+"_"+makeId(friend)+"_"+platform,
                    source:makeId(person),
                    target:makeId(friend),
                    platform:platform
                }
            });
        });
    }

    cy.add([...nodes.values(),...edges]);
    applyVertexColoring();

    cy.layout({
        name:"cose",
        animate:true,
        padding:50
    }).run();

    showDetails(person);
}

function applyVertexColoring(){
    const colors = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22"];

    cy.nodes().forEach(node=>{
        let usedColors = [];

        node.neighborhood("node").forEach(neighbor=>{
            if(neighbor.data("color")){
                usedColors.push(neighbor.data("color"));
            }
        });

        for(let color of colors){
            if(!usedColors.includes(color)){
                node.data("color",color);
                break;
            }
        }
    });
}

function showDetails(person){
    if(!socialData[person]){
        document.getElementById("details").innerHTML = "No saved data for " + person;
        return;
    }

    let total = 0;
    let html = `<h3>${person}</h3>`;

    for(let platform in socialData[person]){
        total += socialData[person][platform].length;
    }

    html += `Direct Connections: ${total}<hr>`;

    for(let platform in socialData[person]){
        html += `<b>${platform}</b><br>`;

        socialData[person][platform].forEach(friend=>{
            html += `
                <div style="margin-bottom:10px;">
                    ${friend}<br>
                    <button class="remove" onclick="removeConnection('${person}','${friend}','${platform}')">
                        Remove Connection
                    </button>
                </div>
            `;
        });

        html += "<hr>";
    }

    document.getElementById("details").innerHTML = html;
}

async function removeConnection(person, friend, platform){
    if(socialData[person] && socialData[person][platform]){
        socialData[person][platform] = socialData[person][platform].filter(name=>name !== friend);

        if(socialData[person][platform].length === 0){
            delete socialData[person][platform];
        }
    }

    if(socialData[friend] && socialData[friend][platform]){
        socialData[friend][platform] = socialData[friend][platform].filter(name=>name !== person);

        if(socialData[friend][platform].length === 0){
            delete socialData[friend][platform];
        }
    }

    await savePerson(person);
    await savePerson(friend);
    buildGraph(person);
    loadSocialFolders();
}

function findPersonByName(search){
    for(let person in socialData){
        if(person.toLowerCase() === search.toLowerCase()){
            return person;
        }
    }

    return null;
}

function searchPerson(){
    const search = document.getElementById("searchName").value.trim();

    if(!search){
        alert("Enter a name.");
        return;
    }

    const found = findPersonByName(search);

    if(!found){
        cy.elements().remove();
        document.getElementById("details").innerHTML = "Person not found: " + search;
        return;
    }

    currentPerson = found;
    buildGraph(found);
}

function toggleMenu(){
    const menu = document.getElementById("sideMenu");
    menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function closeMenu(){
    document.getElementById("sideMenu").style.display = "none";
}

function toggleSocialFolder(){
    const folder = document.getElementById("socialFolder");
    const arrow = document.getElementById("folderArrow");

    if(folder.style.display === "block"){
        folder.style.display = "none";
        arrow.innerHTML = "▶";
    }else{
        folder.style.display = "block";
        arrow.innerHTML = "▼";
    }
}

function loadSocialFolders(){
    const folder = document.getElementById("socialFolder");
    folder.innerHTML = "";

    Object.keys(socialData).sort().forEach(person=>{
        const row = document.createElement("div");
        row.className = "folder-row";

        const item = document.createElement("div");
        item.className = "folder folder-name";
        item.innerHTML = "📁 " + person + "'s Socials";

        item.onclick = function(){
            currentPerson = person;
            buildGraph(person);
            closeMenu();
        };

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-folder";
        deleteButton.innerHTML = "🗑️";

        deleteButton.onclick = async function(event){
            event.stopPropagation();
            await deletePerson(person);
        };

        row.appendChild(item);
        row.appendChild(deleteButton);
        folder.appendChild(row);
    });
}

async function deletePerson(person){
    const confirmDelete = confirm("Delete " + person + "'s socials?");

    if(!confirmDelete){
        return;
    }

    delete socialData[person];
    await deleteDoc(doc(db,"socials",person));

    for(let otherPerson in socialData){
        for(let platform in socialData[otherPerson]){
            socialData[otherPerson][platform] = socialData[otherPerson][platform].filter(name=>name !== person);

            if(socialData[otherPerson][platform].length === 0){
                delete socialData[otherPerson][platform];
            }
        }

        await savePerson(otherPerson);
    }

    cy.elements().remove();
    loadSocialFolders();
    document.getElementById("details").innerHTML = person + "'s socials deleted.";
}

async function resetData(){
    const confirmReset = confirm("Reset all saved data and load the default people?");

    if(!confirmReset){
        return;
    }

    const querySnapshot = await getDocs(collection(db,"socials"));

    for(const item of querySnapshot.docs){
        await deleteDoc(doc(db,"socials",item.id));
    }

    socialData = structuredClone(defaultSocialData);
    await saveAllData(false);

    cy.elements().remove();
    loadSocialFolders();
    document.getElementById("details").innerHTML = "Default data loaded again.";
}

function clearSearchText(){
    document.getElementById("searchName").value = "";
    document.getElementById("clearSearch").style.display = "none";
}

cy.on("tap","node",function(evt){
    const node = evt.target;
    const name = node.data("label");

    if(selectedNodeId === node.id()){
        cy.nodes().removeClass("highlighted");
        selectedNodeId = null;
        document.getElementById("details").innerHTML = "Click a person to view connections.";
    }else{
        selectedNodeId = node.id();
        cy.nodes().removeClass("highlighted");
        node.addClass("highlighted");
        node.neighborhood("node").addClass("highlighted");
        showDetails(name);
    }
});

cy.on("tap",function(evt){
    if(evt.target === cy){
        cy.nodes().removeClass("highlighted");
        selectedNodeId = null;
    }
});

document.getElementById("searchName").addEventListener("input",function(){
    document.getElementById("clearSearch").style.display = this.value.length > 0 ? "block" : "none";
});

document.getElementById("searchName").addEventListener("keydown",function(event){
    if(event.key === "Enter"){
        searchPerson();
    }
});

document.getElementById("clearSearch").addEventListener("click",clearSearchText);
document.getElementById("searchBtn").addEventListener("click",searchPerson);
document.getElementById("addBtn").addEventListener("click",addSocialConnection);
document.getElementById("saveBtn").addEventListener("click",()=>saveAllData(true));
document.getElementById("resetBtn").addEventListener("click",resetData);
document.getElementById("menuBtn").addEventListener("click",toggleMenu);
document.getElementById("closeMenuBtn").addEventListener("click",closeMenu);
document.getElementById("socialMain").addEventListener("click",toggleSocialFolder);

window.removeConnection = removeConnection;
window.clearSearchText = clearSearchText;
window.searchPerson = searchPerson;
window.addSocialConnection = addSocialConnection;
window.saveData = saveAllData;
window.resetData = resetData;
window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;
window.toggleSocialFolder = toggleSocialFolder;

loadAllData();
