



//* MongoDB  Aggregation stages
[
  {
    $match: {
      isActive: true,
    },
  },
  {
    $count: "activeUsers",
  },
]

// 2

[
  {
    $group: {
      _id: "$age",
      
    }
  }
]

// **All Average Age ***
[
  {
    $group: {
      _id: null,
      averageAge:{
        $avg:"$age"
      }
      
    }
  }
]

// *** Group Average Age by Genders ***
[
  {
    $group: {
      _id: "$gender",
      averageAge:{
        $avg:"$age"
      }
      
    }
  }
]

// 3 *** Favorite fruits Sorting ***

[
  {
    $group: {
      _id: "$favoriteFruit",
      count: {
        $sum: 1,
      },
    },
  },
]

// *** Top 2 Favorite fruits Sorting ***

[
  {
    $group: {
      _id: "$favoriteFruit",
      count: {
        $sum: 1,
      },
    },
  },
  {
    $sort: {
      count: -1,
    },
  },
  {
    $limit: 2,
  },
]

// *** Eye color sorting ***
[
  {
    $group: {
      _id: "$eyeColor",
      count: {
        $sum: 1,
      },
    },
  },
]
//******************************************
// *** Top 2 eye colors sorting ***
[
  {
    $group: {
      _id: "$eyeColor",
      count: {
        $sum: 1,
      },
    },
  },
  {
    $sort: {
      count:-1 // highest value on the top for ( -1 ) and  lowest value on the top for ( 1  )
    }
  },
  {
    $limit: 2
  }
]


// *** Counting male and female based on gender***

[
  {
    $group: {
      _id: "$gender",
      genderCount: {
        $sum: 1,
      },
    },
  },
]

// *** Object Drilling ***

[
  {
    $group: {
      _id: "$company.location.country",
      usersCounting: {
        $sum: 1,
      },
    },
  },
  {
    $sort: {
      users: -1,
    },
  },
  {
    $limit: 5,
  },
]

// *** UnWind Operator all Arrays  ***

[
  {
    $unwind: "$tags",
  },
  {
    $group: {
      _id: "$_id",
      countAllTags: {
        $sum: 1,
      },
    },
  },
  {
    $group: {
      _id: null,
      avgOfAllTags: {
        $avg: "$countAlltages",
      },
    },
  },
]

// *** Add a New field in the array obj and count them   ***

[
  {
    $addFields: {
      numberOfTags: {
        $size: { $ifNull: ["$tags", []] }, // if tags is null
      },
    },
  },{
    $group: {
      _id: null,
      avgOfAllTags:{$avg:"$numberOfTags"}

    }
  }
]

// *** Match Aggregation Pipeline  ***

[
  {
    $match: {
      tags: "ad",
    },
  },
  {
    $count: "usersWith-enim-Tag",
  },
]

// *** project and match  ***

[
  {
    $match: {
      isActive: false,
      tags: "velit",
    },
  },
  {
    $project: {
      name: 1,
      age: 1,
    },
  },
]

// *** Exactly typo ***

[
  {
    $match: {
      "company.phone":/^\+1 \(940\)/
    }
  },{
    $count: 'userWithUniquePhNO'
  }
]

// *** Sort ***

[
  {
    $sort: {
      registered: -1,
    },
  },
  {
    $limit: 5,
  },
  {
    $project: {
      name: 1,
      registered: 1,
      favoriteFruit: 1,
      eyeColor: 1,
    },
  },
]

// *** Push accumulator - give all users name an array form***
[
  {
    $group: {
      _id: "$favoriteFruit",
      users: { $push: "$name" },
    },
  },
]
// *** 2nd position searching ***

[
  {
    $match: {
      "tags.1":"ad"
    }
  },{
    $count: 'secondTag-Ad'
  }
]

// *** all Operator***

[
  {
    $match: {
      tags: {
        $all: ["enim", "id"],
      },
    },
  },
]

// *** corresponding location ***

[
  {
    $match: {
      "company.location.country": "USA",
    },
  },
  {
    $group: {
      _id: "$company.title",
      userCount: {
        $sum: 1,
      },
    },
  },
]

// *** LookUp ***

[
  {
    $lookup: {
      from: "authors",
      localField: "author_id",
      foreignField: "_id",
      as: "author_details",
    },
  },
  {
    $addFields: {
      author_details: {
        $first: "$author_details",
      },
    },
  },
]

// *** LookUp ***

[
  {
    $lookup: {
      from: "authors",
      localField: "author_id",
      foreignField: "_id",
      as: "author_details",
    },
  },
  {
    $addFields: {
      author_details: {
       $arrayElemAt:["$author_details",0]
      },
    },
  },
]
