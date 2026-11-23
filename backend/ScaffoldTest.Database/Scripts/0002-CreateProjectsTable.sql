-- A project belongs to the user who created it.
CREATE TABLE [dbo].[Projects] (
    [Id] INT IDENTITY(1,1) NOT NULL,
    [Name] NVARCHAR(200) NOT NULL,
    [UserId] INT NOT NULL,
    CONSTRAINT [PK_Projects] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [FK_Projects_Users_UserId] FOREIGN KEY ([UserId])
        REFERENCES [dbo].[Users] ([Id]) ON DELETE CASCADE
);

-- Names only have to be unique among one user's projects.
CREATE UNIQUE NONCLUSTERED INDEX [IX_Projects_UserId_Name]
    ON [dbo].[Projects] ([UserId] ASC, [Name] ASC);
