PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS app (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  isPublic INTEGER DEFAULT 0,
  clonable INTEGER DEFAULT 0,
  isDirty INTEGER DEFAULT 0,
  isDeleted INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  test INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  screenSize TEXT,
  parent TEXT,
  domain TEXT,
  created INTEGER,
  lastUpdate INTEGER,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
  id TEXT PRIMARY KEY,
  name TEXT,
  lastname TEXT,
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  role TEXT,
  image TEXT,
  status TEXT,
  about TEXT,
  homepage TEXT,
  facebook TEXT,
  tel TEXT,
  domain TEXT,
  has TEXT,
  tos INTEGER DEFAULT 0,
  paidUntil INTEGER DEFAULT 0,
  plan TEXT DEFAULT 'Free',
  lastlogin INTEGER,
  lastNotification INTEGER DEFAULT 0,
  notifications TEXT,
  aiUsage INTEGER DEFAULT 0,
  aiUsageTotal INTEGER DEFAULT 0,
  loginCount INTEGER DEFAULT 0,
  failedLoginAttempts INTEGER DEFAULT 0,
  newsletter INTEGER DEFAULT 0,
  acceptedTOS INTEGER,
  acceptedPrivacy INTEGER,
  acceptedGDPR INTEGER DEFAULT 0,
  acceptedAI INTEGER,
  created INTEGER,
  lastUpdate INTEGER
);

CREATE TABLE IF NOT EXISTS team (
  id TEXT PRIMARY KEY,
  userID TEXT NOT NULL,
  appID TEXT NOT NULL,
  permission INTEGER NOT NULL,
  created INTEGER,
  UNIQUE(userID, appID)
);

CREATE TABLE IF NOT EXISTS invitation (
  id TEXT PRIMARY KEY,
  appID TEXT NOT NULL,
  hash TEXT UNIQUE NOT NULL,
  permission INTEGER NOT NULL,
  created INTEGER
);

CREATE TABLE IF NOT EXISTS image (
  id TEXT PRIMARY KEY,
  appID TEXT,
  userID TEXT,
  name TEXT,
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created INTEGER
);

CREATE TABLE IF NOT EXISTS commandstack (
  id TEXT PRIMARY KEY,
  appID TEXT UNIQUE NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comment (
  id TEXT PRIMARY KEY,
  appID TEXT NOT NULL,
  type TEXT,
  reference TEXT,
  userID TEXT,
  message TEXT,
  created INTEGER,
  data TEXT
);

CREATE TABLE IF NOT EXISTS event (
  id TEXT PRIMARY KEY,
  appID TEXT NOT NULL,
  session TEXT,
  type TEXT,
  created INTEGER,
  data TEXT
);

CREATE TABLE IF NOT EXISTS mouse (
  id TEXT PRIMARY KEY,
  appID TEXT NOT NULL,
  session TEXT,
  created INTEGER,
  data TEXT
);

CREATE TABLE IF NOT EXISTS notification (
  id TEXT PRIMARY KEY,
  userID TEXT,
  message TEXT,
  type TEXT,
  created INTEGER,
  read INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS library (
  id TEXT PRIMARY KEY,
  name TEXT,
  userID TEXT,
  isPublic INTEGER DEFAULT 0,
  created INTEGER,
  lastUpdate INTEGER,
  data TEXT
);

CREATE TABLE IF NOT EXISTS library_team (
  id TEXT PRIMARY KEY,
  userID TEXT NOT NULL,
  libID TEXT NOT NULL,
  permission INTEGER NOT NULL,
  UNIQUE(userID, libID)
);

CREATE TABLE IF NOT EXISTS testsetting (
  id TEXT PRIMARY KEY,
  appID TEXT UNIQUE NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS annotation (
  id TEXT PRIMARY KEY,
  appID TEXT NOT NULL,
  type TEXT,
  reference TEXT,
  data TEXT
);

CREATE TABLE IF NOT EXISTS appevent (
  id TEXT PRIMARY KEY,
  appID TEXT,
  userID TEXT,
  type TEXT,
  created INTEGER,
  data TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_isPublic ON app(isPublic);
CREATE INDEX IF NOT EXISTS idx_app_isDirty ON app(isDirty);
CREATE INDEX IF NOT EXISTS idx_app_user ON app(domain);
CREATE INDEX IF NOT EXISTS idx_event_app_session ON event(appID, session);
CREATE INDEX IF NOT EXISTS idx_event_app ON event(appID);
CREATE INDEX IF NOT EXISTS idx_event_type ON event(appID, type);
CREATE INDEX IF NOT EXISTS idx_mouse_app ON mouse(appID);
CREATE INDEX IF NOT EXISTS idx_team_user ON team(userID);
CREATE INDEX IF NOT EXISTS idx_team_app ON team(appID);
CREATE INDEX IF NOT EXISTS idx_image_app ON image(appID);
CREATE INDEX IF NOT EXISTS idx_image_user ON image(userID);
CREATE INDEX IF NOT EXISTS idx_team_user_app_permission ON team(userID, appID, permission);
CREATE INDEX IF NOT EXISTS idx_invitation_hash ON invitation(hash);
CREATE INDEX IF NOT EXISTS idx_invitation_app ON invitation(appID);
CREATE INDEX IF NOT EXISTS idx_commandstack_app ON commandstack(appID);
CREATE INDEX IF NOT EXISTS idx_comment_app ON comment(appID);
CREATE INDEX IF NOT EXISTS idx_comment_app_type ON comment(appID, type);
CREATE INDEX IF NOT EXISTS idx_comment_app_ref_type ON comment(appID, reference, type);
CREATE INDEX IF NOT EXISTS idx_testsetting_app ON testsetting(appID);
CREATE INDEX IF NOT EXISTS idx_annotation_app ON annotation(appID);
CREATE INDEX IF NOT EXISTS idx_annotation_app_type ON annotation(appID, type);
CREATE INDEX IF NOT EXISTS idx_annotation_app_ref_type ON annotation(appID, reference, type);
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE INDEX IF NOT EXISTS idx_user_id ON user(id);
CREATE INDEX IF NOT EXISTS idx_notification_user ON notification(userID);
CREATE INDEX IF NOT EXISTS idx_library_user ON library(userID);
CREATE INDEX IF NOT EXISTS idx_library_team_user ON library_team(userID);
CREATE INDEX IF NOT EXISTS idx_library_team_lib ON library_team(libID);
CREATE INDEX IF NOT EXISTS idx_appevent_app ON appevent(appID);
