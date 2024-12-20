import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import User from "../models/user.models.js";
import { uploadCloudinary, deleteFormCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

//* Generate the AccessToken and RefreshToken
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError("User not found");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong generating access token and refresh token"
    );
  }
};

//* Register the User
const registerUser = asyncHandler(async (req, res) => {
  const { fullName, userName, email, password } = req.body;

  // Validate

  if (
    [fullName, userName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields must be required");
  }

  const existedUser = await User.findOne({
    $or: [{ fullName }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User already exists, please create a new one ...");
  }

  console.warn(req.files);

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverLocalPath = req.files?.coverImage?.[0]?.path;

  let avatar;
  try {
    avatar = await uploadCloudinary(avatarLocalPath);
    console.log("Uploading avatar", avatar);
  } catch (error) {
    console.log("Error Uploading Avatar", error);
    throw new ApiError(500, "Failed to upload Avatar");
  }
  let coverImage;
  try {
    coverImage = await uploadCloudinary(coverLocalPath);
    console.log("Uploading coverImage", coverImage);
  } catch (error) {
    console.log("Error Uploading coverImage", error);
    throw new ApiError(500, "Failed to upload coverImage");
  }

  try {
    const user = await User.create({
      fullName,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      userName: userName.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken "
    );

    if (!createdUser) {
      throw new ApiError(500, "Something went wrong when creating user");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, createdUser, "User created successfully"));
  } catch (error) {
    console.log("User creation Failed", error);
    if (avatar) {
      await deleteFormCloudinary(avatar.public_id);
    }
    if (coverImage) {
      await deleteFormCloudinary(coverImage.public_id);
    }
    throw new ApiError(
      500,
      "Something went wrong when creating user and Images were Deleted"
    );
  }
});
//* User Login
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    throw new ApiError(400, "email must be provided");
  }
  const user = await User.findOne({
    $or: [{ email }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Validate Password
  //! console.log(user[0].password);

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!loggedInUser) {
    throw new ApiError(404, " User already logged in ...");
  }

  const options = {
    httpOnly: true,
    secure: false,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, refreshToken, accessToken },
        " User Logged In Successfully"
      )
    );
});
//* User LogOut
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out Successfully"));
});

//* Validate the access token and refresh token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError("Refresh token is required");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is not valid");
    }
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "AccessToken Refreshed Successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong during refresh token generation process",
      error
    );
  }
});

//* change the Password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(500, "Password is not valid");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully"));
});

//* Get the User
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user Details"));
});

//* Update user Details

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName && !email) {
    throw new ApiError(500, " FullName and Email are required");
  }
  const user = await User.findOneAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account Details updated successfully"));
});

//* update Avatar of User

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(501, "file is required");
  }
  const avatar = await uploadCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(501, "Something went wrong updated avatar");
  }
  const userAvatar = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password -refreshToken");
  return res
    .status(200)
    .json(new ApiResponse(200, userAvatar, "Avatar updated successfully"));
});

//* Update cover image
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    throw new ApiError(501, "CoverImage file is required");
  }
  const coverImage = await uploadCloudinary(coverImageLocalPath);
  if (!coverImage.url) {
    throw new ApiError(501, "CoverImage file is required");
  }
  const userCoverImage = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(
      new ApiResponse(200, userCoverImage, "CoverImage is Successfully Updated")
    );
});

//*get User channel Profile
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { userName } = req.params;
  if (!userName) {
    throw new ApiError(404, "User not found");
  }
  //Todo: check console logging information
  const channelInfo = await User.aggregate([
    {
      $match: {
        userName: userName?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        userName: 1,
        avatar: 1,
        subscriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channelInfo?.length) {
    throw new ApiError(404, "No channel information available");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channelInfo[0],
        "Channel Information fetched successfully"
      )
    );
});

//*Get Watch History
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: req.user && req.user._id ? new mongoose.Types.ObjectId(req.user._id) : null,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    userName: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0]?.watchHistory,
        "watchHistory updated successfully"
      )
    );
});

//* export all functions
export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
