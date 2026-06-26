import { defaultSocialData } from "./data.js";
import {
    db,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    getDocs
} from "./firebase.js";

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
            style:{
                "line-color":"#1877F2"
            }
        },
        {
            selector:'edge[platform="Instagram"]',
            style:{
                "line-color":"#C13584"
            }
        },
        {
            selector:'edge[platform="TikTok"]',
            style:{
                "line-color":"#000"
            }
        },
        {
            selector:'edge[platform="X"]',
            style:{
                "line-color":"#777"
            }
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
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g,"_")
        .replace(/^_|_$/g,"");
}

function normalizePersonName(name){
    return name.trim();
}

function setStatus(message){
    document.getElementById("details").innerHTML = `<span class="status">${message}</span>`;
}

async function loadAllData(){
    socialData = {};
    const snapshot = await getDocs(collection(db, "socials"));

    snapshot.forEach(item => {
        const data = item.data();
        socialData[item.id] = data.platforms || {};
    });

    if(Object.keys(socialData).length === 0){
        await uploadDefaultData(false);
    }

    loadSocialFolders();
    setStatus("Search a person or open a saved social folder.");
}

async function uploadDefaultData(showAlert){
    socialData = JSON.parse(JSON.stringify(defaultSocialData));
    const people = Object.keys(socialData);

    for(const person of people){
        await setDoc(doc(db, "socials", person), {
            platforms:socialData[person]
        });
    }

    loadSocialFolders();

    if(showAlert){
        alert("Default data uploaded to Firebase.");
    }
}

async function savePerson(person){
    await setDoc(doc(db, "socials", person), {
        platforms:socialData[person] || {}
    });
}

async function saveData(showAlert = false){
    const people = Object.keys(socialData);

    for(const person of people){
        await savePerson(person);
    }

    loadSocialFolders();

    if(showAlert){
        alert("Data saved to Firebase.");
    }
}

async function addSocialConnection(){
    const person = normalizePersonName(document.getElementById("mainPerson").value);
    const friend = normalizePersonName(document.getElementById("connectedPerson").value);
    const platform = document.getElementById("platform").value;

    if(!person || !friend){
        alert("Complete the fields.");
        return;
    }

    if(person.toLowerCase() === friend.toLowerCase()){
        alert("A person cannot connect to themselves.");
        return;
    }

    const realPerson = findPersonKey(person) || person;
    const realFriend = findPersonKey(friend) || friend;

    if(!socialData[realPerson]){
        socialData[realPerson] = {};
    }

    if(!socialData[realFriend]){
        socialData[realFriend] = {};
    }

    if(!socialData[realPerson][platform]){
        socialData[realPerson][platform] = [];
    }

    if(!socialData[realFriend][platform]){
        socialData[realFriend][platform] = [];
    }

    if(!socialData[realPerson][platform].includes(realFriend)){
        socialData[realPerson][platform].push(realFriend);
    }

    if(!socialData[realFriend][platform].includes(realPerson)){
        socialData[realFriend][platform].push(realPerson);
    }

    await savePerson(realPerson);
    await savePerson(realFriend);

    currentPerson = realPerson;
    buildGraph(realPerson);
    loadSocialFolders();

    document.getElementById("mainPerson").value = "";
    document.getElementById("connectedPerson").value = "";
}

function buildGraph(person){
    cy.elements().remove();
    selectedNodeId = null;

    if(!socialData[person]){
        setStatus("No saved data for " + person);
        return;
    }

    const nodes = new Map();
    const edges = [];

    nodes.set(makeId(person), {
        data:{
            id:makeId(person),
            label:person
        }
    });

    const platforms = socialData[person];

    for(const platform in platforms){
        platforms[platform].forEach(friend => {
            nodes.set(makeId(friend), {
                data:{
                    id:makeId(friend),
                    label:friend
                }
            });

            edges.push({
                data:{
                    id:makeId(person) + "_" + makeId(friend) + "_" + makeId(platform),
                    source:makeId(person),
                    target:makeId(friend),
                    platform:platform
                }
            });
        });
    }

    cy.add([...nodes.values(), ...edges]);
    applyVertexColoring();

    cy.layout({
        name:"cose",
        animate:true,
        padding:50
    }).run();

    showDetails(person);
}

function applyVertexColoring(){
    const colors = [
        "#e74c3c",
        "#3498db",
        "#2ecc71",
        "#f1c40f",
        "#9b59b6",
        "#e67e22",
        "#1abc9c",
        "#34495e"
    ];

    cy.nodes().forEach(node => {
        const usedColors = [];

        node.neighborhood("node").forEach(neighbor => {
            if(neighbor.data("color")){
                usedColors.push(neighbor.data("color"));
            }
        });

        for(const color of colors){
            if(!usedColors.includes(color)){
                node.data("color", color);
                break;
            }
        }
    });
}

function showDetails(person){
    if(!socialData[person]){
        setStatus("No saved data for " + person);
        return;
    }

    let totalConnections = 0;
    let html = `<h3>${person}</h3>`;

    for(const platform in socialData[person]){
        totalConnections += socialData[person][platform].length;
    }

    html += `Direct Connections: ${totalConnections}<hr>`;

    const platforms = socialData[person];

    for(const platform in platforms){
        html += `<b>${platform}</b><br>`;

        if(platforms[platform].length === 0){
            html += `<div>No connections</div>`;
        }

        platforms[platform].forEach(friend => {
            html += `
                <div style="margin-bottom:10px;">
                    ${friend}<br>
                    <button class="remove" data-person="${person}" data-friend="${friend}" data-platform="${platform}">
                        Remove Connection
                    </button>
                </div>
            `;
        });

        html += "<hr>";
    }

    document.getElementById("details").innerHTML = html;

    document.querySelectorAll(".remove").forEach(button => {
        button.addEventListener("click", async () => {
            await removeConnection(
                button.dataset.person,
                button.dataset.friend,
                button.dataset.platform
            );
        });
    });
}

async function removeConnection(person, friend, platform){
    if(socialData[person] && socialData[person][platform]){
        socialData[person][platform] = socialData[person][platform].filter(name => name !== friend);

        if(socialData[person][platform].length === 0){
            delete socialData[person][platform];
        }
    }

    if(socialData[friend] && socialData[friend][platform]){
        socialData[friend][platform] = socialData[friend][platform].filter(name => name !== person);

        if(socialData[friend][platform].length === 0){
            delete socialData[friend][platform];
        }
    }

    await savePerson(person);
    await savePerson(friend);
    buildGraph(person);
}

function findPersonKey(search){
    return Object.keys(socialData).find(person => person.toLowerCase() === search.toLowerCase()) || null;
}

async function searchPerson(){
    const search = document.getElementById("searchName").value.trim();

    if(!search){
        alert("Enter a name.");
        return;
    }

    await loadAllData();

    const found = findPersonKey(search);

    if(!found){
        cy.elements().remove();
        setStatus("Person not found: " + search);
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

    Object.keys(socialData).sort().forEach(person => {
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
    await deleteDoc(doc(db, "socials", person));

    for(const otherPerson in socialData){
        let changed = false;

        for(const platform in socialData[otherPerson]){
            const before = socialData[otherPerson][platform].length;
            socialData[otherPerson][platform] = socialData[otherPerson][platform].filter(name => name !== person);

            if(socialData[otherPerson][platform].length === 0){
                delete socialData[otherPerson][platform];
            }

            if(before !== (socialData[otherPerson][platform]?.length || 0)){
                changed = true;
            }
        }

        if(changed){
            await savePerson(otherPerson);
        }
    }

    cy.elements().remove();
    loadSocialFolders();
    setStatus(person + "'s socials deleted.");
}

async function resetData(){
    const confirmReset = confirm("Reset all Firebase data and upload the default people?");

    if(!confirmReset){
        return;
    }

    const snapshot = await getDocs(collection(db, "socials"));

    for(const item of snapshot.docs){
        await deleteDoc(doc(db, "socials", item.id));
    }

    await uploadDefaultData(true);
    cy.elements().remove();
    setStatus("Default data loaded again. Search a person or open a saved social folder.");
}

function clearSearchText(){
    document.getElementById("searchName").value = "";
    document.getElementById("clearSearch").style.display = "none";
}

cy.on("tap", "node", function(evt){
    const node = evt.target;
    const name = node.data("label");

    if(selectedNodeId === node.id()){
        cy.nodes().removeClass("highlighted");
        selectedNodeId = null;
        setStatus("Click a person to view connections.");
    }else{
        selectedNodeId = node.id();
        cy.nodes().removeClass("highlighted");
        node.addClass("highlighted");
        node.neighborhood("node").addClass("highlighted");
        showDetails(name);
    }
});

cy.on("tap", function(evt){
    if(evt.target === cy){
        cy.nodes().removeClass("highlighted");
        selectedNodeId = null;
    }
});

document.getElementById("searchBtn").addEventListener("click", searchPerson);
document.getElementById("addBtn").addEventListener("click", addSocialConnection);
document.getElementById("saveBtn").addEventListener("click", () => saveData(true));
document.getElementById("resetBtn").addEventListener("click", resetData);
document.getElementById("menuBtn").addEventListener("click", toggleMenu);
document.getElementById("closeMenuBtn").addEventListener("click", closeMenu);
document.getElementById("socialMain").addEventListener("click", toggleSocialFolder);
document.getElementById("clearSearch").addEventListener("click", clearSearchText);

document.getElementById("searchName").addEventListener("input", function(){
    document.getElementById("clearSearch").style.display = this.value.length > 0 ? "block" : "none";
});

document.getElementById("searchName").addEventListener("keydown", function(event){
    if(event.key === "Enter"){
        searchPerson();
    }
});

loadAllData().catch(error => {
    console.error(error);
    setStatus("Firebase error. Check your Firestore rules and internet connection.");
});

window.searchPerson = searchPerson;
window.addSocialConnection = addSocialConnection;
window.saveData = saveData;
window.resetData = resetData;
window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;
window.toggleSocialFolder = toggleSocialFolder;
window.clearSearchText = clearSearchText;
