import React, { createContext, useContext, useState, useEffect } from 'react';
import type { UserProfile } from '@/types/types';
import { userProfileApi } from '@/db/api';
import { supabase } from '@/db/supabase';

interface UserProfileContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  session: any | null;
  createProfile: () => Promise<UserProfile | null>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any | null>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadProfile(session?.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        // Fallback to local storage for guest or clear
        // For now, let's just clear if logged out, or try local storage?
        // Let's try local storage if no user
        loadProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string | null | undefined) => {
    setLoading(true);
    try {
      if (userId) {
        // Fetch by user_id via Edge Function (handles decryption)
        const profiles = await userProfileApi.getByUserId(userId);
        
        if (profiles) {
          setUserProfile(profiles);
          localStorage.setItem('userProfileId', profiles.id);
        } else {
          // If auth user but no profile, create one?
          // We can't use userProfileApi.create() directly because it might not set user_id.
          // We'll leave it null and let UI handle it, or auto-create.
          setUserProfile(null);
        }
      } else {
        // Guest mode
        const profileId = localStorage.getItem('userProfileId');
        if (profileId) {
          const profile = await userProfileApi.getById(profileId);
          if (profile) {
            setUserProfile(profile);
          } else {
            localStorage.removeItem('userProfileId');
            setUserProfile(null);
          }
        } else {
          setUserProfile(null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    const profile = await userProfileApi.create();
    if (profile) {
      // If logged in, update with user_id
      if (session?.user) {
        await supabase
          .from('user_profiles')
          .update({ user_id: session.user.id })
          .eq('id', profile.id);
        profile.user_id = session.user.id;
      }
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserProfile(null);
    localStorage.removeItem('userProfileId'); // Clear guest profile too
  };

  return (
    <UserProfileContext.Provider
      value={{
        userProfile,
        loading,
        session,
        createProfile,
        updateProfile,
        refreshProfile,
        signOut
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
