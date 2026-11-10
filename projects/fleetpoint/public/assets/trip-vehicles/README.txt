Trip replay vehicles

sedan.glb, suv.glb, van.glb, pickup.glb and truck.glb are from Kenney's Car Kit 3.1
(www.kenney.nl/assets/car-kit), released under Creative Commons Zero (CC0):
free for commercial use, no attribution required. Thanks, Kenney.

Changes for IoTility: the paint swatch of each model's palette is recoloured pearl white
(#ffffff to #cbc8dc), the glass swatch dark tinted (#4a4960 to #1e1d29), and the palette
is embedded in each .glb so the files are self-contained. Source models:
sedan = sedan, suv = suv, van = van, pickup = truck, truck = delivery.

The replay picks one by the vehicle's type, make and model (tripVehicleKind in
shared/trip-replay-map/trip-replay-map.ts), falling back to the sedan.
