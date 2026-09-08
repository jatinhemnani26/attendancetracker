export type ShapeType = 'polygon' | 'circle';

export interface CampusBuilding {
  id: string;
  number: string;
  name: string;
  shortName: string;
  type: string;
  description: string;
  x: number;  // center X for camera targeting
  y: number;  // center Y for camera targeting  
  color: string;
  floors: number;
  shapeType: ShapeType;
  polygon?: string;  // SVG polygon points string (if shapeType === 'polygon')
  circle?: { cx: number; cy: number; r: number }; // SVG circle properties (if shapeType === 'circle')
  heightFactor: number;  // 1-4, how tall to extrude in 3D mode
  entranceNode: string;  // ID of the entrance node in MapGraph
  category: string;
}

export interface MapPath {
  id: string;
  name?: string;
  category?: string;
  color?: string;
  nodes: { x: number; y: number }[];
}

export const MAP_IMAGE_WIDTH = 800;
export const MAP_IMAGE_HEIGHT = 650;

export const CAMPUS_BUILDINGS: CampusBuilding[] = [
  {
    "id": "block_17",
    "number": "17",
    "name": "Canteen",
    "shortName": "CANTEEN",
    "type": "Dining & Refreshments",
    "description": "Campus cafeteria, juice bar, snacks counter, and outdoor dining patio.",
    "x": 78,
    "y": 137,
    "color": "#6366F1",
    "floors": 1,
    "shapeType": "polygon",
    "polygon": "53,120 54,142 50,141 47,142 47,145 55,149 54,156 56,157 57,163 63,166 65,164 68,167 71,164 76,168 85,163 86,168 90,165 90,170 108,159 96,154 96,133 90,131 93,129 93,124 91,124 91,119 85,117 83,121 79,119 78,121 74,118 73,113 75,112 75,107 68,103 68,106 62,110 62,114",
    "heightFactor": 1,
    "entranceNode": "door_block_17",
    "category": "facility"
  },
  {
    "id": "block_7",
    "number": "7",
    "name": "Computer Engineering ",
    "shortName": "CSE",
    "type": "Engineering Department",
    "description": "Software engineering, AI/ML research labs, high-performance computing cluster.",
    "x": 227,
    "y": 209,
    "color": "#475569",
    "floors": 4,
    "shapeType": "polygon",
    "polygon": "201,182 200,209 226,209 226,235 253,234 253,182",
    "heightFactor": 3,
    "entranceNode": "door_block_7",
    "category": "academic"
  },
  {
    "id": "block_8",
    "number": "8",
    "name": "Information Technology ",
    "shortName": "IT",
    "type": "Engineering Department",
    "description": "Cloud computing lab, cybersecurity unit, web tech studio, and server room.",
    "x": 188,
    "y": 252,
    "color": "#0EA5E9",
    "floors": 4,
    "shapeType": "polygon",
    "polygon": "158,217 157,252 175,252 174,261 165,261 164,286 218,286 218,243 191,244 192,218",
    "heightFactor": 3,
    "entranceNode": "door_block_8",
    "category": "academic"
  },
  {
    "id": "block_10",
    "number": "10",
    "name": "M Wing",
    "shortName": "M-WING",
    "type": "Multi-purpose Academic Wing",
    "description": "Special lecture halls, tutorial rooms, student activity hub, and seminar halls.",
    "x": 124,
    "y": 277,
    "color": "#EF4444",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "105,225 104,270 108,270 108,284 105,284 104,329 142,329 142,285 141,285 141,270 144,270 144,260 142,260 142,225",
    "heightFactor": 3,
    "entranceNode": "door_block_10",
    "category": "academic"
  },
  {
    "id": "block_14",
    "number": "14",
    "name": "Research and Consultancy",
    "shortName": "R&D",
    "type": "Research & Incubation Center",
    "description": "Industry collaboration projects, patent cell, startup incubator, and central testing labs.",
    "x": 557,
    "y": 372,
    "color": "#F472B6",
    "floors": 2,
    "shapeType": "circle",
    "circle": {
      "cx": 557,
      "cy": 372,
      "r": 35
    },
    "heightFactor": 3,
    "entranceNode": "door_block_14",
    "category": "admin"
  },
  {
    "id": "block_15",
    "number": "15",
    "name": "Central Garden",
    "shortName": "GARDEN",
    "type": "Campus Lawn & Open Grounds",
    "description": "Central lush green lawn, walkways, open sitting spaces for study and relaxation.",
    "x": 422,
    "y": 386,
    "color": "#15803D",
    "floors": 0,
    "shapeType": "polygon",
    "polygon": "328,389 355,415 374,395 416,437 397,456 410,469 515,363 516,302 416,302",
    "heightFactor": 1,
    "entranceNode": "door_block_15",
    "category": "facility"
  },
  {
    "id": "block_16",
    "number": "16",
    "name": "Library",
    "shortName": "LIBRARY",
    "type": "Knowledge Resource Center",
    "description": "Over 50,000 volumes, digital research lab, silent reading halls, and journal archives.",
    "x": 603,
    "y": 490,
    "color": "#059669",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "575,444 586,433 597,444 603,438 608,444 619,433 630,444 614,460 619,465 637,466 634,481 651,498 634,514 634,530 619,530 602,546 586,530 570,530 570,513 554,498 571,481 571,466 586,466 591,460",
    "heightFactor": 3,
    "entranceNode": "door_block_16",
    "category": "facility"
  },
  {
    "id": "block_13a",
    "number": "13a",
    "name": "Building 13",
    "shortName": "CLASSROOMS A",
    "type": "Central Lecture Complex",
    "description": "Tiered lecture theatres equipped with smart boards and audio-visual systems.",
    "x": 353,
    "y": 458,
    "color": "#84CC16",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "326,451 359,485 373,472 371,470 379,462 347,430",
    "heightFactor": 3,
    "entranceNode": "door_block_13a",
    "category": "academic"
  },
  {
    "id": "block_13b",
    "number": "13b",
    "name": "Building 13",
    "shortName": "CLASSROOMS B",
    "type": "Central Lecture Complex",
    "description": "Standard classrooms, examination halls, and tutorial rooms.",
    "x": 380,
    "y": 430,
    "color": "#84CC16",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "353,423 386,457 407,436 374,403",
    "heightFactor": 3,
    "entranceNode": "door_block_13b",
    "category": "academic"
  },
  {
    "id": "block_13c",
    "number": "13c",
    "name": "Building 13",
    "shortName": "CLASSROOMS C",
    "type": "Central Lecture Complex",
    "description": "Spacious lecture halls and group discussion rooms.",
    "x": 403,
    "y": 508,
    "color": "#84CC16",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "383,508 396,494 397,495 399,494 398,493 404,487 411,493 411,496 416,501 418,501 423,507 423,510 418,515 403,529",
    "heightFactor": 3,
    "entranceNode": "door_block_13c",
    "category": "academic"
  },
  {
    "id": "block_13d",
    "number": "13d",
    "name": "Building 13",
    "shortName": "CLASSROOMS A",
    "type": "Central Lecture Complex",
    "description": "Tiered lecture theatres equipped with smart boards and audio-visual systems.",
    "x": 465,
    "y": 502,
    "color": "#84CC16",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "439,506 438,510 459,530 492,495 471,474",
    "heightFactor": 3,
    "entranceNode": "door_block_13d",
    "category": "academic"
  },
  {
    "id": "block_13e",
    "number": "13e",
    "name": "Building 13",
    "shortName": "CLASSROOMS A",
    "type": "Central Lecture Complex",
    "description": "Tiered lecture theatres equipped with smart boards and audio-visual systems.",
    "x": 470,
    "y": 442,
    "color": "#84CC16",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "431,460 443,473 450,468 457,475 464,468 457,461 463,455 449,442 470,422 482,435 488,429 496,437 503,431 495,423 501,417 487,404 508,383 529,405 433,500 429,500 423,494 424,493 418,487 417,488 411,481 411,479 417,473 419,474 430,462",
    "heightFactor": 3,
    "entranceNode": "door_block_13e",
    "category": "academic"
  },
  {
    "id": "block_13f",
    "number": "13f",
    "name": "Building 13",
    "shortName": "CLASSROOMS A",
    "type": "Central Lecture Complex",
    "description": "Tiered lecture theatres equipped with smart boards and audio-visual systems.",
    "x": 528,
    "y": 438,
    "color": "#84CC16",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "501,444 522,465 529,458 528,457 547,438 549,439 555,433 555,430 553,431 541,420 542,417 534,411 528,417 528,420 523,425 520,424",
    "heightFactor": 3,
    "entranceNode": "door_block_13f",
    "category": "academic"
  },
  {
    "id": "block_9",
    "number": "9",
    "name": "Electronics and Communication Building",
    "shortName": "ECE",
    "type": "Engineering Department",
    "description": "VLSI design, embedded systems, DSP lab, microwave and wireless communication labs.",
    "x": 206,
    "y": 348,
    "color": "#F43F5E",
    "floors": 4,
    "shapeType": "polygon",
    "polygon": "158,295 157,329 184,328 183,337 158,337 157,363 192,363 197,368 201,371 201,400 237,399 237,381 254,381 253,345 227,345 227,336 218,337 218,328 218,295",
    "heightFactor": 3,
    "entranceNode": "door_block_9",
    "category": "academic"
  },
  {
    "id": "block_11",
    "number": "11",
    "name": "Mechanical Workshop",
    "shortName": "WORKSHOP",
    "type": "Central Workshop Facility",
    "description": "Foundry, smithy, welding, carpentry, fitting, and CNC machine shops.",
    "x": 187,
    "y": 468,
    "color": "#0D9488",
    "floors": 1,
    "shapeType": "polygon",
    "polygon": "122,465 122,470 185,533 189,533 251,470 251,465 190,403 184,403",
    "heightFactor": 3,
    "entranceNode": "door_block_11",
    "category": "academic"
  },
  {
    "id": "block_12",
    "number": "12",
    "name": "Civil Engineering",
    "shortName": "CIVIL ENGG",
    "type": "Engineering Department",
    "description": "Structural engineering, concrete tech, geotechnical lab, surveying equipment depot.",
    "x": 272,
    "y": 504,
    "color": "#FB923C",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "213,524 285,453 331,499 312,519 320,528 301,547 291,538 278,551 273,545 266,551 253,538 236,555 230,549 234,544",
    "heightFactor": 3,
    "entranceNode": "door_block_12",
    "category": "academic"
  },
  {
    "id": "block_1",
    "number": "1",
    "name": "Admin Block",
    "shortName": "ADMIN",
    "type": "Administration & Principal Office",
    "description": "Central administrative offices, student affairs, registrar, accounts, and directorate.",
    "x": 518,
    "y": 208,
    "color": "#EAB308",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "491,183 491,234 519,235 544,211 543,183 535,183 535,180 500,181 500,184",
    "heightFactor": 3,
    "entranceNode": "door_block_1",
    "category": "admin"
  },
  {
    "id": "block_2",
    "number": "2",
    "name": "Applied Humanities & Science",
    "shortName": "HUMANITIES",
    "type": "Academic Department",
    "description": "Department of Applied Mathematics, Physics, Chemistry, and Professional Communication.",
    "x": 453,
    "y": 209,
    "color": "#EC4899",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "423,183 423,192 431,192 431,226 440,226 441,234 457,235 458,209 482,208 482,183",
    "heightFactor": 3,
    "entranceNode": "door_block_2",
    "category": "academic"
  },
  {
    "id": "block_3",
    "number": "3",
    "name": "Chemical Engineering",
    "shortName": "CHEM ENGG",
    "type": "Engineering Department",
    "description": "Chemical process labs, heat transfer labs, reaction engineering, and faculty cabins.",
    "x": 407,
    "y": 256,
    "color": "#F97316",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "380,226 389,225 389,234 423,234 423,243 432,244 433,260 406,261 406,286 380,286",
    "heightFactor": 3,
    "entranceNode": "door_block_3",
    "category": "academic"
  },
  {
    "id": "block_4",
    "number": "4",
    "name": "Bio Technology",
    "shortName": "BIO-TECH",
    "type": "Engineering Department",
    "description": "Microbiology, genetic engineering, bioinformatics labs, and advanced research facilities.",
    "x": 342,
    "y": 320,
    "color": "#10B981",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "312,294 311,303 322,303 321,337 329,337 329,346 346,345 346,320 372,319 372,294",
    "heightFactor": 3,
    "entranceNode": "door_block_4",
    "category": "academic"
  },
  {
    "id": "block_5",
    "number": "5",
    "name": "Mechanical Engineering ",
    "shortName": "MECH ENGG",
    "type": "Engineering Department",
    "description": "Thermodynamics, fluid mechanics, CAD/CAM design studio, and departmental library.",
    "x": 294,
    "y": 369,
    "color": "#64748B",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "269,337 277,337 278,346 312,346 312,355 320,355 321,371 294,371 295,393 297,396 293,400 267,399 267,390 269,388 269,380 266,380 266,363 269,363",
    "heightFactor": 3,
    "entranceNode": "door_block_5",
    "category": "academic"
  },
  {
    "id": "block_6",
    "number": "6",
    "name": "Electrical Engineering",
    "shortName": "EE",
    "type": "Engineering Department",
    "description": "Power systems, electric drives, control systems labs, and renewable energy center.",
    "x": 319,
    "y": 217,
    "color": "#A855F7",
    "floors": 3,
    "shapeType": "polygon",
    "polygon": "269,183 269,226 266,227 267,242 269,244 269,262 271,261 278,261 278,263 297,263 297,251 295,251 294,235 293,209 372,210 372,171 311,172 312,183",
    "heightFactor": 3,
    "entranceNode": "door_block_6",
    "category": "academic"
  },
  {
    "id": "block_stationery",
    "number": "📚",
    "name": "Stationery & Xerox",
    "shortName": "STATIONERY",
    "type": "Student Amenity",
    "description": "Stationery supplies, photocopying, printing, project binding, and academic essentials.",
    "x": 474,
    "y": 299,
    "color": "#F59E0B",
    "floors": 1,
    "shapeType": "circle",
    "circle": {
      "cx": 474,
      "cy": 299,
      "r": 12
    },
    "heightFactor": 1,
    "entranceNode": "door_block_stationery",
    "category": "facility"
  }
];

export const MAIN_PATHS: MapPath[] = [
  {
    "id": "route_north_artery",
    "name": "North Academic Arterial Road",
    "category": "road",
    "color": "#38BDF8",
    "nodes": [
      {
        "x": 78,
        "y": 155
      },
      {
        "x": 90,
        "y": 129
      },
      {
        "x": 135,
        "y": 154
      },
      {
        "x": 178,
        "y": 158
      },
      {
        "x": 227,
        "y": 170
      },
      {
        "x": 260,
        "y": 170
      },
      {
        "x": 319,
        "y": 165
      },
      {
        "x": 407,
        "y": 165
      },
      {
        "x": 453,
        "y": 170
      },
      {
        "x": 518,
        "y": 170
      },
      {
        "x": 565,
        "y": 170
      }
    ]
  },
  {
    "id": "route_west_corridor",
    "name": "West Wing Corridor (M-Wing / IT / ECE)",
    "category": "road",
    "color": "#818CF8",
    "nodes": [
      {
        "x": 135,
        "y": 154
      },
      {
        "x": 149,
        "y": 219
      },
      {
        "x": 150,
        "y": 270
      },
      {
        "x": 150,
        "y": 340
      },
      {
        "x": 150,
        "y": 400
      },
      {
        "x": 244,
        "y": 429
      },
      {
        "x": 248,
        "y": 456
      },
      {
        "x": 264,
        "y": 457
      },
      {
        "x": 270,
        "y": 485
      },
      {
        "x": 285,
        "y": 445
      },
      {
        "x": 270,
        "y": 485
      }
    ]
  },
  {
    "id": "route_central_spine",
    "name": "Central Academic Spine (CSE-EE-Chem-Mech)",
    "category": "road",
    "color": "#34D399",
    "nodes": [
      {
        "x": 260,
        "y": 170
      },
      {
        "x": 260,
        "y": 235
      },
      {
        "x": 260,
        "y": 290
      },
      {
        "x": 260,
        "y": 345
      },
      {
        "x": 260,
        "y": 400
      }
    ]
  },
  {
    "id": "route_garden_perimeter",
    "name": "Central Garden Outer Promenade",
    "category": "walkway",
    "color": "#FBBF24",
    "nodes": [
      {
        "x": 150,
        "y": 293
      },
      {
        "x": 260,
        "y": 290
      },
      {
        "x": 375,
        "y": 290
      },
      {
        "x": 450,
        "y": 290
      },
      {
        "x": 525,
        "y": 290
      },
      {
        "x": 520,
        "y": 360
      },
      {
        "x": 500,
        "y": 410
      },
      {
        "x": 415,
        "y": 440
      },
      {
        "x": 325,
        "y": 395
      },
      {
        "x": 260,
        "y": 400
      }
    ]
  },
  {
    "id": "route_classrooms_spine",
    "name": "Block 13 Classrooms Wayfinding Avenue",
    "category": "walkway",
    "color": "#A3E635",
    "nodes": [
      {
        "x": 325,
        "y": 395
      },
      {
        "x": 345,
        "y": 425
      },
      {
        "x": 375,
        "y": 460
      },
      {
        "x": 420,
        "y": 470
      },
      {
        "x": 465,
        "y": 460
      },
      {
        "x": 475,
        "y": 505
      },
      {
        "x": 535,
        "y": 450
      }
    ]
  },
  {
    "id": "route_library_avenue",
    "name": "Library & South-East Campus Plaza",
    "category": "road",
    "color": "#2DD4BF",
    "nodes": [
      {
        "x": 520,
        "y": 360
      },
      {
        "x": 535,
        "y": 450
      },
      {
        "x": 565,
        "y": 475
      },
      {
        "x": 599,
        "y": 420
      },
      {
        "x": 539,
        "y": 542
      }
    ]
  },
  {
    "id": "route_workshop_civil_link",
    "name": "Workshop to Civil & Mech Connector",
    "category": "road",
    "color": "#FB923C",
    "nodes": [
      {
        "x": 150,
        "y": 400
      },
      {
        "x": 185,
        "y": 400
      },
      {
        "x": 260,
        "y": 400
      },
      {
        "x": 285,
        "y": 445
      },
      {
        "x": 345,
        "y": 425
      }
    ]
  },
  {
    "id": "custom_1788860141045",
    "name": "Exit Route 1",
    "category": "road",
    "color": "#38BDF8",
    "nodes": [
      {
        "x": 565,
        "y": 170
      },
      {
        "x": 589,
        "y": 278
      },
      {
        "x": 636,
        "y": 292
      },
      {
        "x": 677,
        "y": 302
      },
      {
        "x": 712,
        "y": 300
      },
      {
        "x": 751,
        "y": 305
      }
    ]
  },
  {
    "id": "custom_1788860172336",
    "name": "Exit Route 2",
    "category": "road",
    "color": "#38BDF8",
    "nodes": [
      {
        "x": 599,
        "y": 420
      },
      {
        "x": 606,
        "y": 387
      },
      {
        "x": 601,
        "y": 352
      },
      {
        "x": 597,
        "y": 320
      },
      {
        "x": 589,
        "y": 278
      }
    ]
  },
  {
    "id": "custom_1788860408656",
    "name": "Civil To Library",
    "category": "road",
    "color": "#38BDF8",
    "nodes": [
      {
        "x": 539,
        "y": 542
      },
      {
        "x": 454,
        "y": 550
      },
      {
        "x": 403,
        "y": 553
      },
      {
        "x": 367,
        "y": 555
      },
      {
        "x": 331,
        "y": 552
      },
      {
        "x": 331,
        "y": 524
      },
      {
        "x": 337,
        "y": 498
      },
      {
        "x": 313,
        "y": 469
      },
      {
        "x": 285,
        "y": 453
      }
    ]
  }
];
