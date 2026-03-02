import { GetServerSideProps } from 'next';
import axios from 'axios';
import styles from '../../styles/ClassDetail.module.css';

interface Class {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
  teacher: {
    name: string;
    email: string;
  };
}

interface ClassDetailProps {
  danceClass: Class;
}

export default function ClassDetail({ danceClass }: ClassDetailProps) {
  const videoId = danceClass.videoUrl.split('v=')[1];

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <h1 className={styles.title}>{danceClass.title}</h1>
        <div className={styles.content}>
          <div className={styles.videoContainer}>
            <iframe
              width="560"
              height="315"
              src={`https://www.youtube.com/embed/${videoId}`}
              title={danceClass.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className={styles.details}>
            <h2>Descripción</h2>
            <p>{danceClass.description}</p>
            <h2>Profesor</h2>
            <p>{danceClass.teacher.name}</p>
            <p>{danceClass.teacher.email}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}/classes/${params?.id}`
    );
    return {
      props: {
        danceClass: response.data,
      },
    };
  } catch (error) {
    return {
      notFound: true,
    };
  }
}; 