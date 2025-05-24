declare module 'snoowrap' {
  export interface RedditVideo {
    fallback_url: string;
    duration: number;
    height: number;
    width: number;
    dash_url: string;
    hls_url: string;
    is_gif: boolean;
    scrubber_media_url: string;
    transcoding_status: string;
  }

  export interface RedditMedia {
    reddit_video?: RedditVideo;
  }

  export interface GalleryItem {
    media_id: string;
    caption?: string;
    outbound_url?: string;
  }

  export interface GalleryData {
    items: GalleryItem[];
  }

  export interface RedditAward {
    name: string;
    description: string;
    count: number;
    icon_url: string;
  }

  export interface Submission {
    is_gallery?: boolean;
    gallery_data?: GalleryData;
    media: RedditMedia | null;
    all_awardings?: RedditAward[];
    author: { name: string };
    created_utc: number;
    id: string;
    permalink: string;
    title: string;
    selftext: string;
    url: string;
    subreddit: { display_name: string };
    score: number;
    num_comments: number;
    is_video: boolean;
    link_flair_text?: string;
    over_18: boolean;
    spoiler: boolean;
    pinned: boolean;
    locked: boolean;
    comments: Comment[];
  }

  export interface Comment {
    all_awardings?: RedditAward[];
    author: { name: string };
    body: string;
    created_utc: number;
    id: string;
    link_id: string;
    parent_id: string;
    permalink: string;
    score: number;
    subreddit: { display_name: string };
    edited: boolean;
    stickied: boolean;
    is_submitter: boolean;
    depth: number;
    replies: Comment[];
  }

  export interface Subreddit {
    display_name: string;
    getNew(options?: { limit: number }): Promise<Submission[]>;
  }

  export interface User {
    name: string;
    getSubmissions(options?: { limit: number }): Promise<Submission[]>;
    getComments(options?: { limit: number }): Promise<Comment[]>;
  }

  export default class Snoowrap {
    constructor(options: {
      userAgent: string;
      clientId: string;
      clientSecret: string;
      username?: string;
      password?: string;
    });

    getMe(): Promise<User>;
    getSubreddit(name: string): Promise<Subreddit>;
    getUser(username: string): Promise<User>;
  }
} 