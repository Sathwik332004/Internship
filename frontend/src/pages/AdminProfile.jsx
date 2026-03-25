import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import {
  normalizeEmail,
  normalizePhone,
  normalizeTextInput,
  validatePasswordChangeForm,
  validateProfileForm
} from "../utils/validation";

const AdminProfile = () => {

  const { setUser } = useAuth();

  const token = localStorage.getItem("token");

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    role: ""
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {

      const res = await axios.get("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });

      setProfile({
        name: res.data.data.name,
        email: res.data.data.email,
        phone: res.data.data.phone || "",
        role: res.data.data.role
      });

    } catch (error) {
      toast.error("Failed to load profile");
    }
  };

  const handleProfileChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const updateProfile = async () => {
    const profileToSubmit = {
      ...profile,
      name: normalizeTextInput(profile.name).trim(),
      email: normalizeEmail(profile.email),
      phone: normalizePhone(profile.phone)
    };

    const validationError = validateProfileForm(profileToSubmit);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoadingProfile(true);

    try {

      const res = await axios.put(
        "/api/auth/updatedetails",
        profileToSubmit,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const updatedUser = res.data.data;

      setUser(updatedUser); // â­ Update AuthContext
      localStorage.setItem("user", JSON.stringify(updatedUser));

      setProfile({
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || "",
        role: updatedUser.role
      });

      toast.success("Profile updated successfully");

    } catch (error) {

      toast.error(
        error.response?.data?.message || "Failed to update profile"
      );

    }

    setLoadingProfile(false);
  };

  const changePassword = async () => {
    const validationError = validatePasswordChangeForm(passwordData);
    if (validationError) {
      return toast.error(validationError);
    }

    setLoadingPassword(true);

    try {

      await axios.put(
        "/api/auth/updatepassword",
        passwordData,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      toast.success("Password updated successfully");

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });

    } catch (error) {

      toast.error(
        error.response?.data?.message || "Failed to update password"
      );

    }

    setLoadingPassword(false);
  };

  return (
    <div className="mx-auto max-w-4xl rounded-2xl bg-white p-4 shadow sm:p-6 lg:p-8">

      <h2 className="text-2xl font-semibold mb-6">Admin Profile</h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

        <div>
          <label className="text-sm font-medium text-gray-600">Name</label>
          <input
            type="text"
            name="name"
            value={profile.name}
            maxLength={50}
            onChange={(e) => handleProfileChange({
              target: {
                name: e.target.name,
                value: normalizeTextInput(e.target.value)
              }
            })}
            className="w-full border rounded p-2 mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600">Email</label>
          <input
            type="email"
            name="email"
            value={profile.email}
            onChange={handleProfileChange}
            className="w-full border rounded p-2 mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600">Phone</label>
          <input
            type="text"
            name="phone"
            value={profile.phone}
            inputMode="numeric"
            maxLength={10}
            onChange={(e) => handleProfileChange({
              target: {
                name: e.target.name,
                value: normalizePhone(e.target.value)
              }
            })}
            className="w-full border rounded p-2 mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600">Role</label>
          <input
            type="text"
            value={profile.role}
            disabled
            className="w-full border rounded p-2 mt-1 bg-gray-100"
          />
        </div>

      </div>

      <button
        onClick={updateProfile}
        disabled={loadingProfile}
        className="mt-6 bg-emerald-600 text-white px-6 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
      >
        {loadingProfile ? "Updating..." : "Update Profile"}
      </button>

      <h3 className="text-xl font-semibold mt-10 mb-4">Change Password</h3>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

        <div>
          <label>Current Password</label>
          <input
            type="password"
            name="currentPassword"
            value={passwordData.currentPassword}
            onChange={handlePasswordChange}
            className="w-full border rounded p-2 mt-1"
          />
        </div>

        <div>
          <label>New Password</label>
          <input
            type="password"
            name="newPassword"
            value={passwordData.newPassword}
            onChange={handlePasswordChange}
            className="w-full border rounded p-2 mt-1"
          />
        </div>

        <div>
          <label>Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={passwordData.confirmPassword}
            onChange={handlePasswordChange}
            className="w-full border rounded p-2 mt-1"
          />
        </div>

      </div>

      <button
        onClick={changePassword}
        disabled={loadingPassword}
        className="mt-6 bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {loadingPassword ? "Changing..." : "Change Password"}
      </button>

    </div>
  );
};

export default AdminProfile;
