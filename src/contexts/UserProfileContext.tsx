import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '@/types/types';
import { userProfileApi } from '@/db/api';

interface UserProfileContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  createProfile: () => Promise<UserProfile | null>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从localStorage加载用户画像ID
    const loadProfile = async () => {
      const profileId = localStorage.getItem('userProfileId');
      
      if (profileId) {
        const profile = await userProfileApi.getById(profileId);
        if (profile) {
          setUserProfile(profile);
        } else {
          // 如果画像不存在，清除localStorage
          localStorage.removeItem('userProfileId');
        }
      }
      
      setLoading(false);
    };

    loadProfile();
  }, []);

  const createProfile = async () => {
    const profile = await userProfileApi.create();
    if (profile) {
      setUserProfile(profile);
      localStorage.setItem('userProfileId', profile.id);
    }
    return profile;
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;
    
    const updated = await userProfileApi.update(userProfile.id, updates);
    if (updated) {
      setUserProfile(updated);
    }
  };

  const refreshProfile = async () => {
    if (!userProfile) return;
    
    const refreshed = await userProfileApi.getById(userProfile.id);
    if (refreshed) {
      setUserProfile(refreshed);
    }
  };

  return (
    <UserProfileContext.Provider
      value={{
        userProfile,
        loading,
        createProfile,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
};
