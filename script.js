"use strict";
//Global Variables
const USGS_API_REQUEST =
  "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=30&minlatitude=5&maxlatitude=25&minlongitude=115&maxlongitude=135";
const STATION_REQUEST = "./var/seismic_stn.json";
const PHILIPPINE_CENTER = [12.8797, 121.774, 6];
const PAR_POLYLINE = [
  [5, 115],
  [15, 115],
  [21, 120],
  [25, 120],
  [25, 135],
  [5, 135],
  [5, 115],
];
const INTENSITY_COLORS = [
  undefined,
  "86AE59",
  "C0D731",
  "FFC20F",
  "F7941F",
  "F46F2C",
  "F0452B",
  "EA1C29",
  "D6186E",
  "A01252",
];
//Window Variables
const cardWindow = document.querySelector(".bottom_index");
const stationCards = document.getElementById("station_cards");
const earthquakeCards = document.getElementById("earthquake_cards");
const topIndex = document.querySelector(".top_index");
//Async function

//Philippine Area of Responsibility
//5°N 115°E, 15°N 115°E, 21°N 120°E, 25°N 135°E and 5°N 135°E.

class Application {
  _openedTab = 0;
  _map;
  _mapEvent;
  _stationList = [];
  _earthquakeList = [];
  _markerDict = {};
  _htmlDict = {};
  constructor() {
    //Async handlers
    this.init();

    //Event listener for card clicks
    topIndex.addEventListener("click", this._tabSwitch.bind(this));
  }

  async init() {
    await this._buildMap();
    this._stationList = await this._parseStations();
    this._earthquakeList = await this._getRecentFromUSGS();
    cardWindow.addEventListener("click", this._cardClickHandler.bind(this));
  }
  _timeout(seconds = 10) {
    return new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error("Request took too long"));
      }, seconds * 1000);
    });
  }

  async _getJSON(directory, timeout = 10) {
    try {
      const data = await Promise.race([
        fetch(directory),
        this._timeout(timeout),
      ]);
      // if (!data.ok) throw new Error(`Failed to fetch ${directory}.`);
      const json_data = await data.json("");
      return json_data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
  async _buildMap() {
    const [lat, long, zoom] = PHILIPPINE_CENTER;
    const coords = [lat, long];
    let click_layer;
    // console.log(lat, long, zoom);
    this._map = L.map("map").setView(coords, zoom);

    //Generate Map
    try {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | <a href="https://www.phivolcs.dost.gov.ph/"> PHIVOLCS </a> | <a href="https://www.usgs.gov/">USGS</a>',
      }).addTo(this._map);

      //Generate Philippine Area of Responsibility Polyline
      L.polyline(PAR_POLYLINE, {
        color: "red",
        weight: 1,
        opacity: 0.5,
        smoothFactor: 1,
      }).addTo(this._map);

      click_layer = L.featureGroup().addTo(this._map);
      //Generate markers
      this._stn1Marker = L.icon({
        iconUrl: "./img/stn--1.png",
        shadowUrl: "./img/stn--shadow--1.png",
        iconSize: [20, 25],
        shadowSize: [20, 25],
      });
      this._stn2Marker = L.icon({
        iconUrl: "./img/stn--2.png",
        shadowUrl: "./img/stn--shadow--1.png",
        iconSize: [20, 25],
        shadowSize: [20, 25],
      });
      this._stn3Marker = L.icon({
        iconUrl: "./img/stn--3.png",
        shadowUrl: "./img/stn--shadow--1.png",
        iconSize: [20, 25],
        shadowSize: [20, 25],
      });
    } catch (err) {
      console.error(err);
    }
  }

  _getGeolocation() {}

  _lockComputation() {}

  async _parseStations() {
    const stnData = await this._getJSON(STATION_REQUEST);
    console.log(stnData);
    await this._drawMarkerMap(stnData);
    await this._drawStationHTML(stnData);
    return stnData;
  }

  async _drawMarkerMap(data_array, renderType = 1) {
    data_array.forEach(function (current) {
      let ico;
      if (renderType === 1) {
        const { code, long_name: ln, type, long, lat } = current;
        switch (type) {
          case "STSS":
            ico = app._stn1Marker;
            break;
          case "SCSS":
            ico = app._stn2Marker;
            break;
          case "VS":
            ico = app._stn3Marker;
            break;
        }
        app._markerDict[code] = L.marker([long, lat], {
          id: code,
          icon: ico,
          title: `${code}: ${ln}`,
        })
          .addTo(app._map)
          .bindPopup(L.popup({}))
          .setPopupContent(`${code}: ${ln}`)
          .on("click", (e) => app._panToHTML(e.target.options.id, 1));
      }
      if (renderType === 2) {
        //earthquakes
        const { mag, magType, title, place, code } = current.properties;
        const [lat, long, depth] = current.geometry.coordinates;
        const marker = L.icon({
          iconUrl: "./img/epicenter.png",
          iconSize: app._computeMagnitudeImage(mag),
        });
        app._markerDict[code] = L.marker([long, lat], {
          id: code,
          icon: marker,
          title: `${mag}${magType} - ${place}`,
        })
          .addTo(app._map)
          .bindPopup(L.popup({}))
          .setPopupContent(`${title}`)
          .on("click", (e) => app._panToHTML(e.target.options.id, 0));
      }
    });
    return;
  }

  _panToHTML(id, tab) {
    console.log(id, tab);
    const [element] = document.querySelectorAll(`[data-code="${id}"]`);
    if (!this._openedTab == tab) this._tabSwap(tab);
    element.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
    element.style.opacity = 1;
    element.style.boxShadow = "15px 15px 5px 199px rgba(255,250,111,1) inset";
    setTimeout(() => {
      element.style.removeProperty("opacity");
      element.style.removeProperty("box-shadow");
    }, 1000);
  }
  async _drawStationHTML(stationlist) {
    stationlist.forEach(function (stn_object) {
      const { code, long_name: ln, type, long, lat } = stn_object;
      const html = `              
      <li class="card station ${type}" data-code="${code}" data-long='${long}' data-lat='${lat}'>
        <h2 class="station__name">${code}</h2>
          <div class="station__type">${type}</div>
            <h3 class="station__longname">${ln}</h3>
              <div class="station__coordinates">
        <span class="coordinates">
        ${long}, ${lat} <span class="emoji" data-function='location'>🗺️</span></span>
      </div>
    </li>`;

      app._htmlDict[code] = stationCards.insertAdjacentHTML("beforeend", html);
      return;
    });
  }

  _moveToCoordinates(coords, zoomLevel = 13) {
    this._map.setView(coords, zoomLevel, {
      animate: true,
    });
  }

  _cardClickHandler(e) {
    console.log(e.target);
    if (!e.target.closest(".card")) return;
    const currentTab = this._openedTab;
    const clickedCard = e.target.closest(".card");

    if (e.target.dataset.function) {
      const activity = e.target.dataset.function;
      let toOpen;
      if (activity === "location") {
        toOpen = `https://www.google.com/maps/place/@${clickedCard.dataset.long},${clickedCard.dataset.lat},15z`;
      }
      if (activity === "url") {
        toOpen = clickedCard.dataset.url;
      }
      window.open(toOpen, "_blank");
    }

    if (currentTab === 1) {
      const stationID = this._stationList.find(({ code }) => {
        return code === clickedCard.dataset.code;
      });
      this._moveToCoordinates([stationID.long, stationID.lat], 9);
      return;
    }

    if (currentTab === 0) {
      console.log(this._earthquakeList);
      const earthquakeID = this._earthquakeList.find((current) => {
        return current.properties.code === clickedCard.dataset.code;
      });
      console.log(earthquakeID);
      const [lat, long, _] = earthquakeID.geometry.coordinates;
      this._moveToCoordinates([long, lat], 9);
      return;
    }
    //0 - earthquakes, 1 - stations, 2- calculator
  }

  async _getRecentFromUSGS() {
    const earthquakeData = await this._getJSON(USGS_API_REQUEST);
    console.log(earthquakeData);
    console.log(typeof earthquakeData.features);
    this._drawMarkerMap(earthquakeData.features, 2);
    this._displayQuakesHTML(earthquakeData.features);
    return earthquakeData.features;
  }
  _computeMagnitudeImage(magnitude) {
    let out = [50, 50];
    if (magnitude < 4) {
      return out;
    }
    const MAX = 500;
    const BASE = 50;
    const factor = (MAX - BASE) * (Math.log10(magnitude) / 10);
    return [50 + factor, 50 + factor];
  }

  _displayQuakesHTML(events) {
    events.forEach(function (current) {
      const { mag, magType, place, tsunami, time, code, url } =
        current.properties;
      const magcolor = INTENSITY_COLORS[Math.floor(mag)];
      const [lat, long, depth] = current.geometry.coordinates;
      const html = `              
      <li class="card earthquake" data-code=${code} data-long='${long}' data-lat='${lat}' data-url='${url}' style='background: linear-gradient(to right, #${magcolor} 20%, #fcfaec 20%)'>
      <h1 class="earthquake__magnitude">${mag} ${magType}</h1>
      <h2 class="earthquake__place">${place}</h2>
      <div class=>${
        tsunami ? "Tsunami warning issued." : "No tsunami warning."
      }</div>
      <h3 class="earthquake__datetime">${new Date(time)}</h3>
      <div class='coordinates'>
        <span class="coord">${lat}, ${long}, ${depth}km deep</span>
        <span class="emoji" data-function='location'>🗺️</span>
        <span class="emoji" data-function='url'>🌐</span>
      </div>`;

      app._htmlDict[code] = earthquakeCards.insertAdjacentHTML(
        "beforeend",
        html
      );
      return;
    });
  }
  _tabSwitch(e) {
    console.log(e.target);
    if (!e.target.dataset.tabindex) {
      const [lat, long, zoom] = PHILIPPINE_CENTER;
      this._moveToCoordinates([lat, long], zoom);
      return;
    }
    const selector = e.target.dataset.tabindex;
    this._tabSwap(selector, e.target);
  }
  _tabSwap(selector) {
    this._openedTab = +selector;
    const tabs = document.querySelectorAll(".tabselection");
    const cardDivs = document.querySelectorAll(".card_block");
    tabs.forEach((current) => {
      current.classList.remove("selected");
    });
    tabs[+selector].classList.add("selected");
    cardDivs.forEach((current) => {
      current.classList.add("hidden");
      console.log(current);
      if (current.dataset.id == selector) current.classList.remove("hidden");
    });
  }
}

const app = new Application();

// app._getJSON(STATION_REQUEST);
// app._getJSON(USGS_API_REQUEST);
