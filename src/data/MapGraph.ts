export interface MapNode {
  id: string;
  x: number;
  y: number;
  floor: number;
  type: 'entrance' | 'corridor' | 'staircase' | 'connector';
}

export interface MapEdge {
  from: string;
  to: string;
  distance: number;
  floor: number;
}

export const MAP_NODES: MapNode[] = [
  {
    "id": "n_canteen",
    "x": 78,
    "y": 155,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_bend_7173",
    "x": 90,
    "y": 129,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_bend_6435",
    "x": 135,
    "y": 154,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_junc_west",
    "x": 178,
    "y": 158,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_cse_front",
    "x": 227,
    "y": 170,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_junc_central",
    "x": 260,
    "y": 170,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_ee_front",
    "x": 319,
    "y": 165,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_chem_front",
    "x": 407,
    "y": 165,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_humanities",
    "x": 453,
    "y": 170,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_admin_front",
    "x": 518,
    "y": 170,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_east_end",
    "x": 565,
    "y": 170,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "w_mwing_entry",
    "x": 149,
    "y": 219,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "w_it_entry",
    "x": 150,
    "y": 270,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "w_ece_entry",
    "x": 150,
    "y": 340,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "w_junc_workshop",
    "x": 150,
    "y": 400,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "w_workshop_west",
    "x": 244,
    "y": 429,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_bend_1286",
    "x": 248,
    "y": 456,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_bend_9602",
    "x": 264,
    "y": 457,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_bend_3653",
    "x": 270,
    "y": 485,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_bend_5593",
    "x": 285,
    "y": 445,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "w_civil_south",
    "x": 270,
    "y": 485,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "c_mid_1",
    "x": 260,
    "y": 235,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "c_mid_2",
    "x": 260,
    "y": 290,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "c_mid_3",
    "x": 260,
    "y": 345,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "c_garden_nw",
    "x": 260,
    "y": 400,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "n_bend_3817",
    "x": 260,
    "y": 290,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "g_north_1",
    "x": 375,
    "y": 290,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "g_north_2",
    "x": 450,
    "y": 290,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "g_north_east",
    "x": 525,
    "y": 290,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "g_east_rnd",
    "x": 520,
    "y": 360,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "g_south_east",
    "x": 500,
    "y": 410,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "g_south_mid",
    "x": 415,
    "y": 440,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "g_south_west",
    "x": 325,
    "y": 395,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "cr_13a_entry",
    "x": 345,
    "y": 425,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "cr_13b_entry",
    "x": 375,
    "y": 460,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "cr_mid_junc",
    "x": 420,
    "y": 470,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "cr_13e_entry",
    "x": 465,
    "y": 460,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "cr_13d_entry",
    "x": 475,
    "y": 505,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "cr_east_exit",
    "x": 535,
    "y": 450,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "lib_west_plaza",
    "x": 565,
    "y": 475,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "lib_main_entrance",
    "x": 599,
    "y": 420,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "lib_south_walk",
    "x": 539,
    "y": 542,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "w_mid_entry",
    "x": 185,
    "y": 400,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "civil_north_entry",
    "x": 285,
    "y": 445,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860114596_0",
    "x": 565,
    "y": 170,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860117684_1",
    "x": 589,
    "y": 278,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860123166_2",
    "x": 636,
    "y": 292,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860124494_3",
    "x": 677,
    "y": 302,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860125434_4",
    "x": 712,
    "y": 300,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860126316_5",
    "x": 751,
    "y": 305,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860161794_0",
    "x": 599,
    "y": 420,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860163397_1",
    "x": 606,
    "y": 387,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860164441_2",
    "x": 601,
    "y": 352,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860165422_3",
    "x": 597,
    "y": 320,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860168859_4",
    "x": 589,
    "y": 278,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860381223_0",
    "x": 539,
    "y": 542,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860382386_1",
    "x": 454,
    "y": 550,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860383705_2",
    "x": 403,
    "y": 553,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860384642_3",
    "x": 367,
    "y": 555,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860386435_4",
    "x": 331,
    "y": 552,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860387442_5",
    "x": 331,
    "y": 524,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860388309_6",
    "x": 337,
    "y": 498,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860389539_7",
    "x": 313,
    "y": 469,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "pt_1788860392421_8",
    "x": 285,
    "y": 453,
    "floor": 0,
    "type": "corridor"
  },
  {
    "id": "door_block_17",
    "x": 78,
    "y": 137,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_7",
    "x": 227,
    "y": 209,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_8",
    "x": 188,
    "y": 252,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_10",
    "x": 124,
    "y": 277,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_9",
    "x": 206,
    "y": 348,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_11",
    "x": 187,
    "y": 468,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_12",
    "x": 272,
    "y": 504,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_6",
    "x": 319,
    "y": 217,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_5",
    "x": 294,
    "y": 369,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_4",
    "x": 342,
    "y": 320,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_3",
    "x": 407,
    "y": 256,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_2",
    "x": 453,
    "y": 209,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_1",
    "x": 518,
    "y": 208,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_14",
    "x": 557,
    "y": 372,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_15",
    "x": 422,
    "y": 386,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_16",
    "x": 603,
    "y": 490,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_13a",
    "x": 353,
    "y": 458,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_13b",
    "x": 380,
    "y": 430,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_13c",
    "x": 403,
    "y": 508,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_13d",
    "x": 465,
    "y": 502,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_13e",
    "x": 470,
    "y": 442,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_13f",
    "x": 528,
    "y": 438,
    "floor": 0,
    "type": "entrance"
  },
  {
    "id": "door_block_stationery",
    "x": 474,
    "y": 299,
    "floor": 0,
    "type": "entrance"
  }
];

export const MAP_EDGES: MapEdge[] = [
  {
    "from": "n_canteen",
    "to": "n_bend_7173",
    "distance": 28.6,
    "floor": 0
  },
  {
    "from": "n_bend_7173",
    "to": "n_bend_6435",
    "distance": 51.5,
    "floor": 0
  },
  {
    "from": "n_bend_6435",
    "to": "n_junc_west",
    "distance": 43.2,
    "floor": 0
  },
  {
    "from": "n_junc_west",
    "to": "n_cse_front",
    "distance": 50.4,
    "floor": 0
  },
  {
    "from": "n_cse_front",
    "to": "n_junc_central",
    "distance": 33,
    "floor": 0
  },
  {
    "from": "n_junc_central",
    "to": "n_ee_front",
    "distance": 59.2,
    "floor": 0
  },
  {
    "from": "n_ee_front",
    "to": "n_chem_front",
    "distance": 88,
    "floor": 0
  },
  {
    "from": "n_chem_front",
    "to": "n_humanities",
    "distance": 46.3,
    "floor": 0
  },
  {
    "from": "n_humanities",
    "to": "n_admin_front",
    "distance": 65,
    "floor": 0
  },
  {
    "from": "n_admin_front",
    "to": "n_east_end",
    "distance": 47,
    "floor": 0
  },
  {
    "from": "n_junc_west",
    "to": "w_mwing_entry",
    "distance": 66.5,
    "floor": 0
  },
  {
    "from": "w_mwing_entry",
    "to": "w_it_entry",
    "distance": 51,
    "floor": 0
  },
  {
    "from": "w_it_entry",
    "to": "w_ece_entry",
    "distance": 70,
    "floor": 0
  },
  {
    "from": "w_ece_entry",
    "to": "w_junc_workshop",
    "distance": 60,
    "floor": 0
  },
  {
    "from": "w_junc_workshop",
    "to": "w_workshop_west",
    "distance": 98.4,
    "floor": 0
  },
  {
    "from": "w_workshop_west",
    "to": "n_bend_1286",
    "distance": 27.3,
    "floor": 0
  },
  {
    "from": "n_bend_1286",
    "to": "n_bend_9602",
    "distance": 16,
    "floor": 0
  },
  {
    "from": "n_bend_9602",
    "to": "n_bend_3653",
    "distance": 28.6,
    "floor": 0
  },
  {
    "from": "n_bend_3653",
    "to": "n_bend_5593",
    "distance": 42.7,
    "floor": 0
  },
  {
    "from": "n_bend_5593",
    "to": "w_civil_south",
    "distance": 42.7,
    "floor": 0
  },
  {
    "from": "n_junc_central",
    "to": "c_mid_1",
    "distance": 65,
    "floor": 0
  },
  {
    "from": "c_mid_1",
    "to": "c_mid_2",
    "distance": 55,
    "floor": 0
  },
  {
    "from": "c_mid_2",
    "to": "c_mid_3",
    "distance": 55,
    "floor": 0
  },
  {
    "from": "c_mid_3",
    "to": "c_garden_nw",
    "distance": 55,
    "floor": 0
  },
  {
    "from": "c_mid_2",
    "to": "n_bend_3817",
    "distance": 110,
    "floor": 0
  },
  {
    "from": "n_bend_3817",
    "to": "g_north_1",
    "distance": 115,
    "floor": 0
  },
  {
    "from": "g_north_1",
    "to": "g_north_2",
    "distance": 75,
    "floor": 0
  },
  {
    "from": "g_north_2",
    "to": "g_north_east",
    "distance": 75,
    "floor": 0
  },
  {
    "from": "g_north_east",
    "to": "g_east_rnd",
    "distance": 70.2,
    "floor": 0
  },
  {
    "from": "g_east_rnd",
    "to": "g_south_east",
    "distance": 53.9,
    "floor": 0
  },
  {
    "from": "g_south_east",
    "to": "g_south_mid",
    "distance": 90.1,
    "floor": 0
  },
  {
    "from": "g_south_mid",
    "to": "g_south_west",
    "distance": 100.6,
    "floor": 0
  },
  {
    "from": "g_south_west",
    "to": "c_garden_nw",
    "distance": 65.2,
    "floor": 0
  },
  {
    "from": "g_south_west",
    "to": "cr_13a_entry",
    "distance": 36.1,
    "floor": 0
  },
  {
    "from": "cr_13a_entry",
    "to": "cr_13b_entry",
    "distance": 46.1,
    "floor": 0
  },
  {
    "from": "cr_13b_entry",
    "to": "cr_mid_junc",
    "distance": 46.1,
    "floor": 0
  },
  {
    "from": "cr_mid_junc",
    "to": "cr_13e_entry",
    "distance": 46.1,
    "floor": 0
  },
  {
    "from": "cr_13e_entry",
    "to": "cr_13d_entry",
    "distance": 46.1,
    "floor": 0
  },
  {
    "from": "cr_13d_entry",
    "to": "cr_east_exit",
    "distance": 81.4,
    "floor": 0
  },
  {
    "from": "g_east_rnd",
    "to": "cr_east_exit",
    "distance": 91.2,
    "floor": 0
  },
  {
    "from": "cr_east_exit",
    "to": "lib_west_plaza",
    "distance": 39.1,
    "floor": 0
  },
  {
    "from": "lib_west_plaza",
    "to": "lib_main_entrance",
    "distance": 64.7,
    "floor": 0
  },
  {
    "from": "lib_main_entrance",
    "to": "lib_south_walk",
    "distance": 136,
    "floor": 0
  },
  {
    "from": "w_junc_workshop",
    "to": "w_mid_entry",
    "distance": 35,
    "floor": 0
  },
  {
    "from": "w_mid_entry",
    "to": "c_garden_nw",
    "distance": 75,
    "floor": 0
  },
  {
    "from": "c_garden_nw",
    "to": "civil_north_entry",
    "distance": 51.5,
    "floor": 0
  },
  {
    "from": "civil_north_entry",
    "to": "cr_13a_entry",
    "distance": 63.2,
    "floor": 0
  },
  {
    "from": "pt_1788860114596_0",
    "to": "pt_1788860117684_1",
    "distance": 110.6,
    "floor": 0
  },
  {
    "from": "pt_1788860117684_1",
    "to": "pt_1788860123166_2",
    "distance": 49,
    "floor": 0
  },
  {
    "from": "pt_1788860123166_2",
    "to": "pt_1788860124494_3",
    "distance": 42.2,
    "floor": 0
  },
  {
    "from": "pt_1788860124494_3",
    "to": "pt_1788860125434_4",
    "distance": 35.1,
    "floor": 0
  },
  {
    "from": "pt_1788860125434_4",
    "to": "pt_1788860126316_5",
    "distance": 39.3,
    "floor": 0
  },
  {
    "from": "pt_1788860161794_0",
    "to": "pt_1788860163397_1",
    "distance": 33.7,
    "floor": 0
  },
  {
    "from": "pt_1788860163397_1",
    "to": "pt_1788860164441_2",
    "distance": 35.4,
    "floor": 0
  },
  {
    "from": "pt_1788860164441_2",
    "to": "pt_1788860165422_3",
    "distance": 32.2,
    "floor": 0
  },
  {
    "from": "pt_1788860165422_3",
    "to": "pt_1788860168859_4",
    "distance": 42.8,
    "floor": 0
  },
  {
    "from": "pt_1788860381223_0",
    "to": "pt_1788860382386_1",
    "distance": 85.4,
    "floor": 0
  },
  {
    "from": "pt_1788860382386_1",
    "to": "pt_1788860383705_2",
    "distance": 51.1,
    "floor": 0
  },
  {
    "from": "pt_1788860383705_2",
    "to": "pt_1788860384642_3",
    "distance": 36.1,
    "floor": 0
  },
  {
    "from": "pt_1788860384642_3",
    "to": "pt_1788860386435_4",
    "distance": 36.1,
    "floor": 0
  },
  {
    "from": "pt_1788860386435_4",
    "to": "pt_1788860387442_5",
    "distance": 28,
    "floor": 0
  },
  {
    "from": "pt_1788860387442_5",
    "to": "pt_1788860388309_6",
    "distance": 26.7,
    "floor": 0
  },
  {
    "from": "pt_1788860388309_6",
    "to": "pt_1788860389539_7",
    "distance": 37.6,
    "floor": 0
  },
  {
    "from": "pt_1788860389539_7",
    "to": "pt_1788860392421_8",
    "distance": 32.2,
    "floor": 0
  },
  {
    "from": "door_block_17",
    "to": "n_bend_7173",
    "distance": 14.4,
    "floor": 0
  },
  {
    "from": "door_block_7",
    "to": "n_cse_front",
    "distance": 39,
    "floor": 0
  },
  {
    "from": "door_block_8",
    "to": "w_it_entry",
    "distance": 42,
    "floor": 0
  },
  {
    "from": "door_block_10",
    "to": "w_it_entry",
    "distance": 26.9,
    "floor": 0
  },
  {
    "from": "door_block_9",
    "to": "c_mid_3",
    "distance": 54.1,
    "floor": 0
  },
  {
    "from": "door_block_11",
    "to": "n_bend_1286",
    "distance": 62.2,
    "floor": 0
  },
  {
    "from": "door_block_12",
    "to": "n_bend_3653",
    "distance": 19.1,
    "floor": 0
  },
  {
    "from": "door_block_6",
    "to": "n_ee_front",
    "distance": 52,
    "floor": 0
  },
  {
    "from": "door_block_5",
    "to": "g_south_west",
    "distance": 40.5,
    "floor": 0
  },
  {
    "from": "door_block_4",
    "to": "g_north_1",
    "distance": 44.6,
    "floor": 0
  },
  {
    "from": "door_block_3",
    "to": "g_north_1",
    "distance": 46.7,
    "floor": 0
  },
  {
    "from": "door_block_2",
    "to": "n_humanities",
    "distance": 39,
    "floor": 0
  },
  {
    "from": "door_block_1",
    "to": "n_admin_front",
    "distance": 38,
    "floor": 0
  },
  {
    "from": "door_block_14",
    "to": "g_east_rnd",
    "distance": 38.9,
    "floor": 0
  },
  {
    "from": "door_block_15",
    "to": "g_south_mid",
    "distance": 54.5,
    "floor": 0
  },
  {
    "from": "door_block_16",
    "to": "lib_west_plaza",
    "distance": 40.9,
    "floor": 0
  },
  {
    "from": "door_block_13a",
    "to": "cr_13b_entry",
    "distance": 22.1,
    "floor": 0
  },
  {
    "from": "door_block_13b",
    "to": "cr_13b_entry",
    "distance": 30.4,
    "floor": 0
  },
  {
    "from": "door_block_13c",
    "to": "cr_mid_junc",
    "distance": 41.6,
    "floor": 0
  },
  {
    "from": "door_block_13d",
    "to": "cr_13d_entry",
    "distance": 10.4,
    "floor": 0
  },
  {
    "from": "door_block_13e",
    "to": "cr_13e_entry",
    "distance": 18.7,
    "floor": 0
  },
  {
    "from": "door_block_13f",
    "to": "cr_east_exit",
    "distance": 13.9,
    "floor": 0
  },
  {
    "from": "door_block_stationery",
    "to": "g_north_2",
    "distance": 25.6,
    "floor": 0
  },
  {
    "from": "n_east_end",
    "to": "pt_1788860114596_0",
    "distance": 0,
    "floor": 0
  },
  {
    "from": "n_bend_3653",
    "to": "w_civil_south",
    "distance": 0,
    "floor": 0
  },
  {
    "from": "n_bend_5593",
    "to": "civil_north_entry",
    "distance": 0,
    "floor": 0
  },
  {
    "from": "n_bend_5593",
    "to": "pt_1788860392421_8",
    "distance": 8,
    "floor": 0
  },
  {
    "from": "lib_main_entrance",
    "to": "pt_1788860161794_0",
    "distance": 0,
    "floor": 0
  },
  {
    "from": "lib_south_walk",
    "to": "pt_1788860381223_0",
    "distance": 0,
    "floor": 0
  },
  {
    "from": "civil_north_entry",
    "to": "pt_1788860392421_8",
    "distance": 8,
    "floor": 0
  },
  {
    "from": "pt_1788860117684_1",
    "to": "pt_1788860168859_4",
    "distance": 0,
    "floor": 0
  }
];
